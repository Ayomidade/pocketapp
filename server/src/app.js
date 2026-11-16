const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const { requestIdMiddleware, notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/authRoutes');
const integrationRoutes = require('./modules/integrations/integrationRoutes');
const repositoryRoutes = require('./modules/repositories/repositoryRoutes');
const projectRoutes = require('./modules/projects/projectRoutes');
const serviceRoutes = require('./modules/services/serviceRoutes');
const incidentRoutes = require('./modules/incidents/incidentRoutes');
const notificationRoutes = require('./modules/notifications/notificationRoutes');
const webhookRoutes = require('./modules/webhooks/webhookRoutes');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(requestIdMiddleware);

  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  if (env.NODE_ENV !== 'test') {
    app.use(
      '/api/v1',
      rateLimit({
        windowMs: 60 * 1000,
        limit: 120,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'pocketops-api', version: 'v1' });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/integrations', integrationRoutes);
  app.use('/api/v1/repositories', repositoryRoutes);
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/services', serviceRoutes);
  app.use('/api/v1/incidents', incidentRoutes);
  app.use('/api/v1/ops', notificationRoutes);
  app.use('/api/v1/webhooks', webhookRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
