const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { UnauthorizedError, BadRequestError } = require('../utils/errors');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }
  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      sessionId: payload.sid,
      username: payload.username,
    };
    return next();
  } catch {
    return next(new UnauthorizedError('Access token expired or invalid'));
  }
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new BadRequestError('Request validation failed', result.error.flatten()));
    }
    req.validatedBody = result.data;
    return next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new BadRequestError('Query validation failed', result.error.flatten()));
    }
    req.validatedQuery = result.data;
    return next();
  };
}

module.exports = {
  requireAuth,
  validateBody,
  validateQuery,
};
