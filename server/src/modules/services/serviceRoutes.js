const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const {
  RenderConnection,
  Service,
  Deployment,
  HealthCheck,
} = require('../../database/models');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { idempotencyMiddleware } = require('../../middleware/idempotency');
const { decryptSecret } = require('../../utils/crypto');
const {
  listRenderServices,
  listServiceDeploys,
  triggerRenderDeploy,
  getServiceLogs,
} = require('../../integrations/renderClient');
const { executeHealthCheck, computeEffectiveHealthStatus } = require('../health/healthService');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { recordAudit } = require('../audit/auditService');

const router = express.Router();
router.use(requireAuth);

async function requireActiveRenderConnection(userId) {
  const conn = await RenderConnection.findOne({ where: { userId, status: 'active' } });
  if (!conn || !conn.encryptedApiKey) {
    throw new BadRequestError('Active Render account connection required', null, 'RENDER_NOT_CONNECTED');
  }
  return { conn, apiKey: decryptSecret(conn.encryptedApiKey) };
}

router.get('/', async (req, res, next) => {
  try {
    const services = await Service.findAll({
      where: { userId: req.user.id },
      order: [['name', 'ASC']],
    });
    res.json({
      services: services.map((s) => ({
        ...s.toJSON(),
        effectiveHealthStatus: computeEffectiveHealthStatus(s),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/discover', async (req, res, next) => {
  try {
    const { conn, apiKey } = await requireActiveRenderConnection(req.user.id);
    const remoteServices = await listRenderServices(apiKey);
    const synced = [];

    for (const rs of remoteServices) {
      const [row] = await Service.findOrCreate({
        where: { userId: req.user.id, renderServiceId: rs.renderServiceId },
        defaults: {
          id: crypto.randomUUID(),
          userId: req.user.id,
          renderConnectionId: conn.id,
          renderServiceId: rs.renderServiceId,
          name: rs.name,
          serviceType: rs.serviceType,
          repoFullName: rs.repoFullName,
          branch: rs.branch,
          serviceUrl: rs.serviceUrl,
          healthCheckPath: rs.healthCheckPath,
          suspended: rs.suspended,
          metadataJson: rs.metadata,
        },
      });
      await row.update({
        name: rs.name,
        serviceType: rs.serviceType,
        repoFullName: rs.repoFullName,
        branch: rs.branch,
        serviceUrl: rs.serviceUrl,
        healthCheckPath: rs.healthCheckPath,
        suspended: rs.suspended,
        metadataJson: rs.metadata,
      });
      synced.push(row);
    }

    res.json({ discovered: synced.length, services: synced });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const service = await Service.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!service) throw new NotFoundError('Service not found');

    const [deployments, healthChecks] = await Promise.all([
      Deployment.findAll({ where: { serviceId: service.id }, order: [['startedAt', 'DESC']], limit: 10 }),
      HealthCheck.findAll({ where: { serviceId: service.id }, order: [['checkedAt', 'DESC']], limit: 20 }),
    ]);

    res.json({
      service: {
        ...service.toJSON(),
        effectiveHealthStatus: computeEffectiveHealthStatus(service),
      },
      deployments,
      healthChecks,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/deployments', async (req, res, next) => {
  try {
    const service = await Service.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!service) throw new NotFoundError('Service not found');

    if (req.query.refresh === 'true') {
      const { apiKey } = await requireActiveRenderConnection(req.user.id);
      const remoteDeploys = await listServiceDeploys(apiKey, service.renderServiceId);
      for (const rd of remoteDeploys) {
        const [row] = await Deployment.findOrCreate({
          where: { serviceId: service.id, renderDeployId: rd.renderDeployId },
          defaults: { id: crypto.randomUUID(), serviceId: service.id, ...rd },
        });
        await row.update({
          commitSha: rd.commitSha,
          commitMessage: rd.commitMessage,
          status: rd.status,
          startedAt: rd.startedAt,
          finishedAt: rd.finishedAt,
        });
      }
    }

    const deployments = await Deployment.findAll({
      where: { serviceId: service.id },
      order: [['startedAt', 'DESC']],
      limit: 30,
    });
    res.json({ deployments });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/logs', async (req, res, next) => {
  try {
    const service = await Service.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!service) throw new NotFoundError('Service not found');
    const { conn, apiKey } = await requireActiveRenderConnection(req.user.id);
    const type = req.query.type === 'build' ? 'build' : 'app';
    const query = String(req.query.q || '');
    const logs = await getServiceLogs(apiKey, conn.renderOwnerId, service.renderServiceId, { type, query });
    res.json({ logs, type, query });
  } catch (err) {
    next(err);
  }
});

const redeploySchema = z.object({
  confirmProduction: z.literal(true, {
    errorMap: () => ({ message: 'Explicit confirmation (confirmProduction: true) is required to redeploy' }),
  }),
  clearCache: z.boolean().optional().default(false),
});

router.post(
  '/:id/redeploy',
  idempotencyMiddleware({ required: true }),
  validateBody(redeploySchema),
  async (req, res, next) => {
    try {
      const service = await Service.findOne({ where: { id: req.params.id, userId: req.user.id } });
      if (!service) throw new NotFoundError('Service not found');
      const { apiKey } = await requireActiveRenderConnection(req.user.id);

      const triggered = await triggerRenderDeploy(apiKey, service.renderServiceId, {
        clearCache: req.validatedBody.clearCache,
      });

      const deployment = await Deployment.create({
        id: crypto.randomUUID(),
        serviceId: service.id,
        renderDeployId: triggered.renderDeployId,
        commitSha: triggered.commitSha,
        commitMessage: triggered.commitMessage,
        branch: service.branch,
        status: triggered.status,
        triggerSource: 'manual',
        triggeredByUserId: req.user.id,
        startedAt: triggered.startedAt,
      });

      await recordAudit({
        userId: req.user.id,
        action: 'render.service.redeployed',
        resourceType: 'service',
        resourceId: service.id,
        details: { deploymentId: deployment.id, renderDeployId: triggered.renderDeployId },
        req,
      });

      res.status(201).json({ deployment });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/health-check', async (req, res, next) => {
  try {
    const service = await Service.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!service) throw new NotFoundError('Service not found');
    const check = await executeHealthCheck(service.id, { source: 'manual' });
    await service.reload();
    res.json({
      healthCheck: check,
      effectiveHealthStatus: computeEffectiveHealthStatus(service),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
