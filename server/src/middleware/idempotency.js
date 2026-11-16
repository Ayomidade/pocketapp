const crypto = require('crypto');
const { IdempotencyRecord } = require('../database/models');
const { sha256Hex } = require('../utils/crypto');
const { ConflictError } = require('../utils/errors');

function idempotencyMiddleware({ required = false } = {}) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) {
      if (required) {
        return res.status(400).json({
          error: {
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            message: 'Idempotency-Key header is required for this mutating operation',
            requestId: req.id,
          },
        });
      }
      return next();
    }

    const userId = req.user?.id;
    if (!userId) return next();

    const requestHash = sha256Hex(JSON.stringify(req.body || {}));
    const existing = await IdempotencyRecord.findOne({
      where: {
        userId,
        idempotencyKey: String(key),
        method: req.method,
        path: req.baseUrl + req.path,
      },
    });

    if (existing && new Date(existing.expiresAt) > new Date()) {
      if (existing.requestHash !== requestHash) {
        return next(new ConflictError('Idempotency-Key reused with different request payload'));
      }
      return res.status(existing.responseStatus).json(existing.responseBodyJson);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        IdempotencyRecord.upsert({
          id: existing ? existing.id : crypto.randomUUID(),
          userId,
          idempotencyKey: String(key),
          method: req.method,
          path: req.baseUrl + req.path,
          requestHash,
          responseStatus: res.statusCode,
          responseBodyJson: body,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }).catch(() => {});
      }
      return originalJson(body);
    };

    return next();
  };
}

module.exports = { idempotencyMiddleware };
