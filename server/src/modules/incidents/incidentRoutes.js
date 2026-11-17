const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { Incident, IncidentEvent, IncidentResource, HealthCheck, Service, AuthorizedRepository } = require('../../database/models');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { idempotencyMiddleware } = require('../../middleware/idempotency');
const { emitNotification } = require('../notifications/notificationService');
const { executeHealthCheck } = require('../health/healthService');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { recordAudit } = require('../audit/auditService');

const router = express.Router();
router.use(requireAuth);

const VALID_TRANSITIONS = {
  open: ['investigating', 'mitigating', 'monitoring'],
  investigating: ['mitigating', 'monitoring', 'open'],
  mitigating: ['monitoring', 'investigating'],
  monitoring: ['investigating', 'mitigating'],
  resolved: ['open'],
};

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status;
    const where = { userId: req.user.id };
    if (status === 'active') {
      where.status = ['open', 'investigating', 'mitigating', 'monitoring'];
    } else if (status) {
      where.status = status;
    }

    const incidents = await Incident.findAll({
      where,
      include: [{ model: IncidentResource, as: 'resources' }],
      order: [['openedAt', 'DESC']],
    });
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

const createIncidentSchema = z.object({
  title: z.string().min(3).max(200),
  summary: z.string().max(4000).optional().default(''),
  severity: z.enum(['P1', 'P2', 'P3']).default('P2'),
  projectId: z.string().uuid().optional().nullable(),
  resources: z
    .array(
      z.object({
        resourceType: z.enum(['service', 'repository', 'commit', 'pull_request', 'deployment']),
        resourceRef: z.string().min(1),
        label: z.string().min(1),
        metadata: z.record(z.any()).optional(),
      })
    )
    .optional()
    .default([]),
});

router.post('/', validateBody(createIncidentSchema), async (req, res, next) => {
  try {
    const { title, summary, severity, projectId, resources } = req.validatedBody;
    const incident = await Incident.create({
      id: crypto.randomUUID(),
      userId: req.user.id,
      projectId: projectId || null,
      title,
      summary,
      severity,
      status: 'open',
      openedAt: new Date(),
    });

    await IncidentEvent.create({
      id: crypto.randomUUID(),
      incidentId: incident.id,
      actorUserId: req.user.id,
      eventType: 'opened',
      message: `Incident opened (${severity}): ${title}`,
    });

    for (const r of resources) {
      await IncidentResource.create({
        id: crypto.randomUUID(),
        incidentId: incident.id,
        resourceType: r.resourceType,
        resourceRef: r.resourceRef,
        label: r.label,
        metadataJson: r.metadata || null,
      });
    }

    await emitNotification({
      userId: req.user.id,
      eventType: 'incident_alert',
      severity: severity === 'P1' ? 'critical' : 'warning',
      title: `[${severity}] ${title}`,
      body: summary || 'New production incident opened in PocketOps',
      deepLink: `pocketops://incidents/${incident.id}`,
      dedupKey: `incident:${incident.id}:opened`,
      resourceType: 'incident',
      resourceId: incident.id,
    });

    await recordAudit({
      userId: req.user.id,
      action: 'incident.created',
      resourceType: 'incident',
      resourceId: incident.id,
      details: { severity, title },
      req,
    });

    const hydrated = await Incident.findByPk(incident.id, {
      include: [
        { model: IncidentEvent, as: 'events' },
        { model: IncidentResource, as: 'resources' },
      ],
    });
    res.status(201).json({ incident: hydrated });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const incident = await Incident.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: IncidentEvent, as: 'events' },
        { model: IncidentResource, as: 'resources' },
      ],
      order: [[{ model: IncidentEvent, as: 'events' }, 'createdAt', 'ASC']],
    });
    if (!incident) throw new NotFoundError('Incident not found');
    res.json({ incident });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({
  status: z.enum(['open', 'investigating', 'mitigating', 'monitoring']),
  message: z.string().max(2000).optional(),
});

router.post('/:id/status', validateBody(statusSchema), async (req, res, next) => {
  try {
    const incident = await Incident.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!incident) throw new NotFoundError('Incident not found');

    const { status, message } = req.validatedBody;
    const allowed = VALID_TRANSITIONS[incident.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestError(`Cannot transition incident from ${incident.status} to ${status}`);
    }

    const previous = incident.status;
    await incident.update({ status, resolvedAt: null });

    await IncidentEvent.create({
      id: crypto.randomUUID(),
      incidentId: incident.id,
      actorUserId: req.user.id,
      eventType: status === 'open' && previous === 'resolved' ? 'reopened' : 'status_change',
      message: message || `Status updated from ${previous} to ${status}`,
      metadataJson: { from: previous, to: status },
    });

    res.json({ incident });
  } catch (err) {
    next(err);
  }
});

const eventSchema = z.object({
  eventType: z.enum(['note', 'mitigation']).default('note'),
  message: z.string().min(1).max(2000),
  metadata: z.record(z.any()).optional(),
});

router.post('/:id/events', validateBody(eventSchema), async (req, res, next) => {
  try {
    const incident = await Incident.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!incident) throw new NotFoundError('Incident not found');

    const event = await IncidentEvent.create({
      id: crypto.randomUUID(),
      incidentId: incident.id,
      actorUserId: req.user.id,
      eventType: req.validatedBody.eventType,
      message: req.validatedBody.message,
      metadataJson: req.validatedBody.metadata || null,
    });

    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

const linkResourceSchema = z.object({
  resourceType: z.enum(['service', 'repository', 'commit', 'pull_request', 'deployment']),
  resourceRef: z.string().min(1),
  label: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

router.post('/:id/resources', validateBody(linkResourceSchema), async (req, res, next) => {
  try {
    const incident = await Incident.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!incident) throw new NotFoundError('Incident not found');

    const { resourceType, resourceRef, label, metadata } = req.validatedBody;
    if (resourceType === 'service' || resourceType === 'repository') {
      if (!z.string().uuid().safeParse(resourceRef).success) throw new NotFoundError('Resource not found');
      const model = resourceType === 'service' ? Service : AuthorizedRepository;
      const owned = await model.findOne({ where: { id: resourceRef, userId: req.user.id } });
      if (!owned) throw new NotFoundError('Resource not found');
    }
    const [resource] = await IncidentResource.findOrCreate({
      where: { incidentId: incident.id, resourceType, resourceRef },
      defaults: { id: crypto.randomUUID(), incidentId: incident.id, resourceType, resourceRef, label, metadataJson: metadata || null },
    });

    await IncidentEvent.create({
      id: crypto.randomUUID(),
      incidentId: incident.id,
      actorUserId: req.user.id,
      eventType: 'resource_linked',
      message: `Linked ${resourceType}: ${label}`,
      metadataJson: { resourceType, resourceRef },
    });

    res.status(201).json({ resource });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/verify-recovery', async (req, res, next) => {
  try {
    const incident = await Incident.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{ model: IncidentResource, as: 'resources' }],
    });
    if (!incident) throw new NotFoundError('Incident not found');

    const serviceResource = (incident.resources || []).find((r) => r.resourceType === 'service');
    let check = null;
    if (serviceResource) {
      check = await executeHealthCheck(serviceResource.resourceRef, { source: 'post_deploy' });
    }

    await incident.update({ verifiedCheckId: check?.id || null });
    await IncidentEvent.create({
      id: crypto.randomUUID(),
      incidentId: incident.id,
      actorUserId: req.user.id,
      eventType: 'recovery_verified',
      message: check
        ? `Recovery verification check recorded: ${check.status} (${check.latencyMs || 0}ms)`
        : 'Manual recovery verification recorded (no linked HTTP service probe)',
      metadataJson: check ? { checkId: check.id, status: check.status } : null,
    });

    res.json({ verified: true, healthCheck: check });
  } catch (err) {
    next(err);
  }
});

const resolveSchema = z.object({
  confirmResolution: z.literal(true, {
    errorMap: () => ({ message: 'Explicit confirmation is required to resolve an incident' }),
  }),
  resolutionSummary: z.string().min(3).max(2000),
});

router.post(
  '/:id/resolve',
  idempotencyMiddleware({ required: true }),
  validateBody(resolveSchema),
  async (req, res, next) => {
    try {
      const incident = await Incident.findOne({ where: { id: req.params.id, userId: req.user.id } });
      if (!incident) throw new NotFoundError('Incident not found');

      if (incident.verifiedCheckId) {
        const check = await HealthCheck.findByPk(incident.verifiedCheckId);
        if (check && check.status === 'unhealthy') {
          throw new BadRequestError('Latest recovery verification check is unhealthy; re-verify before resolving');
        }
      }

      await incident.update({
        status: 'resolved',
        resolvedAt: new Date(),
        resolutionSummary: req.validatedBody.resolutionSummary,
      });

      await IncidentEvent.create({
        id: crypto.randomUUID(),
        incidentId: incident.id,
        actorUserId: req.user.id,
        eventType: 'resolved',
        message: `Incident explicitly resolved: ${req.validatedBody.resolutionSummary}`,
      });

      await emitNotification({
        userId: req.user.id,
        eventType: 'recovery',
        severity: 'verified',
        title: `Resolved: ${incident.title}`,
        body: req.validatedBody.resolutionSummary,
        deepLink: `pocketops://incidents/${incident.id}`,
        dedupKey: `incident:${incident.id}:resolved`,
        resourceType: 'incident',
        resourceId: incident.id,
      });

      await recordAudit({
        userId: req.user.id,
        action: 'incident.resolved',
        resourceType: 'incident',
        resourceId: incident.id,
        req,
      });

      res.json({ incident });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
