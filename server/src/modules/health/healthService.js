const crypto = require('crypto');
const { Service, HealthCheck } = require('../../database/models');
const { emitNotification } = require('../notifications/notificationService');

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

function computeEffectiveHealthStatus(service) {
  if (!service.lastHealthCheckedAt) return service.lastHealthStatus || 'unknown';
  const ageMs = Date.now() - new Date(service.lastHealthCheckedAt).getTime();
  if (ageMs > STALE_THRESHOLD_MS && service.lastHealthStatus !== 'checking') {
    return 'stale';
  }
  return service.lastHealthStatus;
}

async function executeHealthCheck(serviceId, { source = 'manual', deploymentId = null, probeFn = null } = {}) {
  const service = await Service.findByPk(serviceId);
  if (!service) return null;

  const previousStatus = service.lastHealthStatus;
  if (!service.serviceUrl) {
    const check = await HealthCheck.create({
      id: crypto.randomUUID(),
      serviceId: service.id,
      deploymentId,
      status: 'unknown',
      errorMessage: 'Service has no public HTTP URL configured for health probing',
      source,
      checkedAt: new Date(),
    });
    await service.update({ lastHealthStatus: 'unknown', lastHealthCheckedAt: check.checkedAt });
    return check;
  }

  const targetUrl = `${service.serviceUrl.replace(/\/$/, '')}${service.healthCheckPath || '/health'}`;
  const started = Date.now();
  let status = 'unhealthy';
  let statusCode = null;
  let errorMessage = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = probeFn
      ? await probeFn(targetUrl)
      : await fetch(targetUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);

    statusCode = res.status;
    const latencyMs = Date.now() - started;
    if (res.status >= 200 && res.status < 300) {
      status = latencyMs > 1500 ? 'degraded' : 'healthy';
    } else if (res.status >= 500 || res.status === 404) {
      status = 'unhealthy';
      errorMessage = `HTTP ${res.status}`;
    } else {
      status = 'degraded';
      errorMessage = `HTTP ${res.status}`;
    }

    const check = await HealthCheck.create({
      id: crypto.randomUUID(),
      serviceId: service.id,
      deploymentId,
      status,
      statusCode,
      latencyMs,
      errorMessage,
      source,
      checkedAt: new Date(),
    });

    await service.update({
      lastHealthStatus: status,
      lastHealthCheckedAt: check.checkedAt,
      lastLatencyMs: latencyMs,
    });

    if (previousStatus !== status) {
      if (status === 'unhealthy' || status === 'degraded') {
        await emitNotification({
          userId: service.userId,
          eventType: 'health_state',
          severity: status === 'unhealthy' ? 'critical' : 'warning',
          title: `${service.name} is ${status}`,
          body: errorMessage
            ? `Health probe returned ${errorMessage} (${latencyMs}ms)`
            : `Elevated latency detected (${latencyMs}ms)`,
          deepLink: `pocketops://services/${service.id}/health`,
          dedupKey: `health:${service.id}:${status}`,
          resourceType: 'service',
          resourceId: service.id,
        });
      } else if (status === 'healthy' && (previousStatus === 'unhealthy' || previousStatus === 'degraded')) {
        await emitNotification({
          userId: service.userId,
          eventType: 'recovery',
          severity: 'verified',
          title: `${service.name} recovered`,
          body: `Health check passed (${statusCode}, ${latencyMs}ms). Review open incidents before resolving.`,
          deepLink: `pocketops://services/${service.id}/health`,
          dedupKey: `health:${service.id}:healthy`,
          resourceType: 'service',
          resourceId: service.id,
        });
      }
    }

    return check;
  } catch (err) {
    const latencyMs = Date.now() - started;
    errorMessage = err.name === 'AbortError' ? 'Health probe timed out after 8000ms' : err.message;
    const check = await HealthCheck.create({
      id: crypto.randomUUID(),
      serviceId: service.id,
      deploymentId,
      status: 'unhealthy',
      statusCode: null,
      latencyMs,
      errorMessage,
      source,
      checkedAt: new Date(),
    });

    await service.update({
      lastHealthStatus: 'unhealthy',
      lastHealthCheckedAt: check.checkedAt,
      lastLatencyMs: latencyMs,
    });

    if (previousStatus !== 'unhealthy') {
      await emitNotification({
        userId: service.userId,
        eventType: 'health_state',
        severity: 'critical',
        title: `${service.name} is unreachable`,
        body: errorMessage,
        deepLink: `pocketops://services/${service.id}/health`,
        dedupKey: `health:${service.id}:unhealthy`,
        resourceType: 'service',
        resourceId: service.id,
      });
    }
    return check;
  }
}

module.exports = {
  executeHealthCheck,
  computeEffectiveHealthStatus,
  STALE_THRESHOLD_MS,
};
