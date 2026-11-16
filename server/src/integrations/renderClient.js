const env = require('../config/env');
const { UpstreamError, UnauthorizedError } = require('../utils/errors');

async function renderRequest(apiKey, path, { method = 'GET', body } = {}) {
  const url = `${env.RENDER_API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedError('Render API key rejected or expired', 'RENDER_AUTH_FAILED');
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new UpstreamError(`Render API error (${res.status})`, { status: res.status, body: errText });
  }
  if (res.status === 204) return null;
  return res.json();
}

async function verifyRenderApiKey(apiKey) {
  const owners = await renderRequest(apiKey, '/owners?limit=5');
  const first = Array.isArray(owners) ? owners[0]?.owner || owners[0] : owners;
  return {
    ownerId: first?.id || null,
    ownerEmail: first?.email || null,
    ownerName: first?.name || 'Render Account',
  };
}

async function listRenderServices(apiKey) {
  const rows = await renderRequest(apiKey, '/services?limit=50');
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const s = item.service || item;
    return {
      renderServiceId: s.id,
      name: s.name,
      serviceType: s.type || 'web_service',
      repoFullName: s.repo ? s.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') : null,
      branch: s.branch || 'main',
      serviceUrl: s.serviceDetails?.url || null,
      healthCheckPath: s.serviceDetails?.healthCheckPath || '/health',
      suspended: s.suspended === 'suspended',
      metadata: {
        region: s.serviceDetails?.region,
        plan: s.serviceDetails?.plan,
        runtime: s.serviceDetails?.runtime,
        updatedAt: s.updatedAt,
      },
    };
  });
}

async function listServiceDeploys(apiKey, renderServiceId, limit = 20) {
  const rows = await renderRequest(apiKey, `/services/${encodeURIComponent(renderServiceId)}/deploys?limit=${limit}`);
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const d = item.deploy || item;
    return {
      renderDeployId: d.id,
      commitSha: d.commit?.id || null,
      commitMessage: d.commit?.message || null,
      status: d.status || 'created',
      triggerSource: d.trigger || 'manual',
      startedAt: d.createdAt ? new Date(d.createdAt) : null,
      finishedAt: d.finishedAt ? new Date(d.finishedAt) : null,
    };
  });
}

async function triggerRenderDeploy(apiKey, renderServiceId, { clearCache = false } = {}) {
  const d = await renderRequest(apiKey, `/services/${encodeURIComponent(renderServiceId)}/deploys`, {
    method: 'POST',
    body: { clearCache: clearCache ? 'clear' : 'do_not_clear' },
  });
  return {
    renderDeployId: d.id,
    commitSha: d.commit?.id || null,
    commitMessage: d.commit?.message || null,
    status: d.status || 'created',
    startedAt: d.createdAt ? new Date(d.createdAt) : new Date(),
  };
}

async function getServiceLogs(apiKey, renderOwnerId, renderServiceId, { type = 'app', query = '', limit = 100 } = {}) {
  const params = new URLSearchParams({
    ownerId: renderOwnerId || '',
    resource: renderServiceId,
    limit: String(limit),
    direction: 'backward',
  });
  if (type === 'build' || type === 'app') {
    params.set('type', type);
  }
  if (query) {
    params.set('text', query);
  }
  const data = await renderRequest(apiKey, `/logs?${params.toString()}`);
  const logs = Array.isArray(data?.logs) ? data.logs : Array.isArray(data) ? data : [];
  return logs.map((entry, idx) => ({
    id: entry.id || `${idx}-${entry.timestamp || Date.now()}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    level: entry.labels?.find((l) => l.name === 'level')?.value || 'info',
    message: entry.message || JSON.stringify(entry),
  }));
}

module.exports = {
  verifyRenderApiKey,
  listRenderServices,
  listServiceDeploys,
  triggerRenderDeploy,
  getServiceLogs,
};
