const crypto = require('crypto');
const { Op } = require('sequelize');
const { Notification, NotificationPreference, PushDevice } = require('../../database/models');
const { sendExpoPushBatch, channelForEventType } = require('../../integrations/pushClient');
const logger = require('../../utils/logger');

let enqueuePushFn = null;
function setPushEnqueuer(fn) {
  enqueuePushFn = fn;
}

function isPreferenceEnabled(prefs, eventType) {
  if (!prefs) return true;
  switch (eventType) {
    case 'incident_alert':
      return prefs.incidentAlerts;
    case 'deploy_failure':
      return prefs.deployFailures;
    case 'health_state':
      return prefs.healthAlerts;
    case 'recovery':
      return prefs.recoveryAlerts;
    case 'pr_check':
      return prefs.prCheckAlerts;
    default:
      return true;
  }
}

async function emitNotification({
  userId,
  eventType,
  severity = 'info',
  title,
  body,
  deepLink = 'pocketops://inbox',
  dedupKey = null,
  resourceType = null,
  resourceId = null,
}) {
  // Deduplicate identical events inside a 5-minute window to avoid notification storms
  if (dedupKey) {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recent = await Notification.findOne({
      where: {
        userId,
        dedupKey,
        createdAt: { [Op.gte]: fiveMinsAgo },
      },
    });
    if (recent) {
      return { notification: recent, deduplicated: true };
    }
  }

  const notification = await Notification.create({
    id: crypto.randomUUID(),
    userId,
    eventType,
    severity,
    title,
    body,
    deepLink,
    dedupKey,
    resourceType,
    resourceId,
    deliveryStatus: 'pending',
  });

  if (enqueuePushFn) {
    await enqueuePushFn(notification.id);
  } else {
    await deliverNotificationPush(notification.id);
  }

  return { notification, deduplicated: false };
}

async function deliverNotificationPush(notificationId) {
  const notification = await Notification.findByPk(notificationId);
  if (!notification) return;

  const prefs = await NotificationPreference.findOne({ where: { userId: notification.userId } });
  if (!isPreferenceEnabled(prefs, notification.eventType)) {
    await notification.update({ deliveryStatus: 'skipped' });
    return;
  }

  const devices = await PushDevice.findAll({
    where: { userId: notification.userId, active: true },
  });
  if (devices.length === 0) {
    await notification.update({ deliveryStatus: 'skipped' });
    return;
  }

  const messages = devices.map((d) => ({
    to: d.expoPushToken,
    sound: notification.severity === 'critical' ? 'default' : undefined,
    title: notification.title,
    body: notification.body,
    channelId: channelForEventType(notification.eventType),
    priority: notification.severity === 'critical' ? 'high' : 'normal',
    data: {
      notificationId: notification.id,
      deepLink: notification.deepLink,
      eventType: notification.eventType,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
    },
  }));

  try {
    const { tickets, invalidTokens } = await sendExpoPushBatch(messages);
    if (invalidTokens.length > 0) {
      await PushDevice.update(
        { active: false, invalidReason: 'DeviceNotRegistered' },
        { where: { expoPushToken: invalidTokens } }
      );
    }
    await PushDevice.update(
      { lastDeliveredAt: new Date() },
      { where: { userId: notification.userId, active: true } }
    );
    await notification.update({
      deliveryStatus: 'sent',
      providerTicketId: tickets[0]?.id || null,
    });
  } catch (err) {
    logger.error({ err, notificationId }, 'Push delivery failed; notification remains in persistent inbox');
    await notification.update({ deliveryStatus: 'failed' });
    throw err;
  }
}

module.exports = {
  emitNotification,
  deliverNotificationPush,
  setPushEnqueuer,
};
