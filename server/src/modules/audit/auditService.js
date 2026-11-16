const crypto = require('crypto');
const { AuditLog } = require('../../database/models');

async function recordAudit({ userId, action, resourceType, resourceId = null, outcome = 'success', req = null, details = null }) {
  return AuditLog.create({
    id: crypto.randomUUID(),
    userId: userId || null,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : null,
    outcome,
    ipAddress: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
    detailsJson: details,
  });
}

module.exports = { recordAudit };
