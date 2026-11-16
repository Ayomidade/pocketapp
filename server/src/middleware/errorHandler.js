const crypto = require('crypto');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

function requestIdMiddleware(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
      requestId: req.id,
    },
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || undefined,
        requestId: req.id,
      },
    });
  }

  logger.error({ err, requestId: req.id, path: req.originalUrl }, 'Unhandled server error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred',
      requestId: req.id,
    },
  });
}

module.exports = {
  requestIdMiddleware,
  notFoundHandler,
  errorHandler,
};
