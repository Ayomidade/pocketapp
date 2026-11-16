class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Invalid request', details = null, code = 'BAD_REQUEST') {
    super(400, code, message, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission for this resource', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource state conflict', details = null, code = 'CONFLICT') {
    super(409, code, message, details);
  }
}

class UpstreamError extends AppError {
  constructor(message = 'Upstream provider failure', details = null, code = 'UPSTREAM_ERROR') {
    super(502, code, message, details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UpstreamError,
};
