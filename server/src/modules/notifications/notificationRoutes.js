const crypto = require('crypto');
const express = require('express');
const { Op } = require('sequelize');
const { z } = require('zod');
const {
  Notification,
  NotificationPreference,
  PushDevice,
  AuditLog,
  Incident,
  Project,
  Service,
  Deployment,
  AuthorizedRepository,
  GithubConnection,
  RenderConnection,
} = require('../../database/models');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { computeEffectiveHealthStatus } = require('../health/healthService');
const { NotFoundError } = require('../../utils/errors');

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [
      activeIncidents,
      projects,
      services,
      unreadNotifications,
      githubConn,
      renderConn,
      repoCount,
    ] = await Promise.all([
      Incident.findAll({
        where: { userId, status: ['open', 'investigating', 'mitigating', 'monitoring'] },
        order: [['openedAt', 'DESC']],
        limit: 5,
      }),
      Project.findAll({ where: { userId }, order: [['updatedAt', 'DESC']], limit: 5 }),
      Service.findAll({ where: { userId }, order: [['updatedAt', 'DESC']], limit: 10 }),
      Notification.count({ where: { userId, readAt: null } }),
      GithubConnection.findOne({ where: { userId } }),
      RenderConnection.findOne({ where: { userId } }),
      AuthorizedRepository.count({ where: { userId, active: true } }),
    ]);

    const serviceIds = services.map((s) => s.id);
    const recentDeployments = serviceIds.length
      ? await Deployment.findAll({ where: { serviceId: serviceIds }, order: [['startedAt', 'DESC']], limit: 6 })
      : [];

    const integrationProblems = [];
    if (!githubConn || githubConn.status !== 'active') integrationProblems.push('github_disconnected');
    if (repoCount === 0) integrationProblems.push('no_authorized_repositories');
    if (!renderConn || renderConn.status !== 'active') integrationProblems.push('render_disconnected');

    res.json({
      activeIncidents,
      projects,
      services: services.map((s) => ({ ...s.toJSON(), effectiveHealthStatus: computeEffectiveHealthStatus(s) })),
      recentDeployments,
      failedDeployments: recentDeployments.filter((d) => ['build_failed', 'update_failed'].includes(d.status)),
      unreadNotificationCount: unreadNotifications,
      integrationProblems,
      isFirstUse: projects.length === 0 && services.length === 0 && repoCount === 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ projects: [], repositories: [], services: [], incidents: [] });

    const like = { [Op.like]: `%${q}%` };
    const [projects, repositories, services, incidents] = await Promise.all([
      Project.findAll({ where: { userId: req.user.id, name: like }, limit: 10 }),
      AuthorizedRepository.findAll({ where: { userId: req.user.id, active: true, fullName: like }, limit: 10 }),
      Service.findAll({ where: { userId: req.user.id, name: like }, limit: 10 }),
      Incident.findAll({ where: { userId: req.user.id, title: like }, limit: 10 }),
    ]);

    return res.json({ projects, repositories, services, incidents });
  } catch (err) {
    return next(err);
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.unreadOnly === 'true') where.readAt = null;
    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const notif = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!notif) throw new NotFoundError('Notification not found');
    await notif.update({ readAt: new Date() });
    res.json({ notification: notif });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', async (req, res, next) => {
  try {
    await Notification.update({ readAt: new Date() }, { where: { userId: req.user.id, readAt: null } });
    res.json({ markedAllRead: true });
  } catch (err) {
    next(err);
  }
});

const deviceSchema = z.object({
  expoPushToken: z.string().min(10),
  platform: z.enum(['android', 'ios']).default('android'),
  deviceName: z.string().max(120).optional(),
});

router.post('/notifications/devices', validateBody(deviceSchema), async (req, res, next) => {
  try {
    const { expoPushToken, platform, deviceName } = req.validatedBody;
    const existing = await PushDevice.findOne({ where: { expoPushToken } });
    if (existing) {
      await existing.update({ userId: req.user.id, platform, deviceName, active: true, invalidReason: null });
      return res.json({ device: existing });
    }
    const device = await PushDevice.create({
      id: crypto.randomUUID(),
      userId: req.user.id,
      expoPushToken,
      platform,
      deviceName,
      active: true,
    });
    return res.status(201).json({ device });
  } catch (err) {
    return next(err);
  }
});

router.get('/notifications/preferences', async (req, res, next) => {
  try {
    const [prefs] = await NotificationPreference.findOrCreate({
      where: { userId: req.user.id },
      defaults: { id: crypto.randomUUID(), userId: req.user.id },
    });
    res.json({ preferences: prefs });
  } catch (err) {
    next(err);
  }
});

const prefSchema = z.object({
  incidentAlerts: z.boolean().optional(),
  deployFailures: z.boolean().optional(),
  healthAlerts: z.boolean().optional(),
  recoveryAlerts: z.boolean().optional(),
  prCheckAlerts: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
});

router.put('/notifications/preferences', validateBody(prefSchema), async (req, res, next) => {
  try {
    const [prefs] = await NotificationPreference.findOrCreate({
      where: { userId: req.user.id },
      defaults: { id: crypto.randomUUID(), userId: req.user.id },
    });
    await prefs.update(req.validatedBody);
    res.json({ preferences: prefs });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ auditLogs: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
