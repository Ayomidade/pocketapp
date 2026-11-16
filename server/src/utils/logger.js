const pino = require('pino');
const env = require('../config/env');

const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-hub-signature-256"]',
      '*.accessToken',
      '*.refreshToken',
      '*.apiKey',
      '*.encryptedToken',
      '*.encryptedApiKey',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
