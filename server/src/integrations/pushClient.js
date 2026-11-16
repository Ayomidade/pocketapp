const { Expo } = require('expo-server-sdk');
const env = require('../config/env');
const logger = require('../utils/logger');

const expo = new Expo(env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : {});

const CHANNEL_MAP = {
  incident_alert: 'incidents',
  deploy_failure: 'deployments',
  health_state: 'health',
  recovery: 'health',
  pr_check: 'git',
  integration_alert: 'incidents',
};

async function sendExpoPushBatch(messages) {
  const validMessages = messages.filter((m) => Expo.isExpoPushToken(m.to));
  if (validMessages.length === 0) return { tickets: [], invalidTokens: [] };

  const chunks = expo.chunkPushNotifications(validMessages);
  const tickets = [];
  const invalidTokens = [];

  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      chunkTickets.forEach((ticket, i) => {
        tickets.push({ token: chunk[i].to, ...ticket });
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(chunk[i].to);
        }
      });
    } catch (err) {
      logger.error({ err }, 'Expo push chunk delivery failed');
      throw err;
    }
  }

  return { tickets, invalidTokens };
}

function channelForEventType(eventType) {
  return CHANNEL_MAP[eventType] || 'incidents';
}

module.exports = {
  sendExpoPushBatch,
  channelForEventType,
  isExpoPushToken: Expo.isExpoPushToken,
};
