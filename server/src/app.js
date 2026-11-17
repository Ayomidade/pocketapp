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
    app.use(pinoHttp({
      logger,
      serializers: {
        req(request) {
          if (request.url && /^\/api\/v1\/(?:auth\/github\/callback|github\/installations\/callback)(?:\?|$)/.test(request.url)) {
            return { ...request, url: request.url.split('?')[0], query: {} };
          }
          return request;
        },
        res(response) {
          if (response.headers?.location && /^(?:pocketops|exp):/i.test(response.headers.location)) {
            return { ...response, headers: { ...response.headers, location: '[REDACTED]' } };
          }
          return response;
        },
      },
    }));
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

  // GitHub sends installation setup redirects through a browser without a session token.
  // The ID is only a hint: the authenticated verification endpoint checks ownership.
  app.get('/api/v1/github/installations/callback', async (req, res, next) => {
    try {
    const installationId = String(req.query.installation_id || '');
    if (!/^\d+$/.test(installationId)) {
      return res.status(400).type('text/plain').send('Missing or invalid GitHub installation ID.');
    }
    res.set('Cache-Control', 'no-store');
    const stateValue = typeof req.query.state === 'string' ? req.query.state : '';
    if (stateValue && /^[A-Za-z0-9_-]+$/.test(stateValue)) {
      const { OAuthState } = require('./database/models');
      const state = await OAuthState.findOne({ where: { state: stateValue, purpose: 'github_install', consumedAt: null } });
      if (state && new Date(state.expiresAt) > new Date() && state.redirectUri === 'pocketops://github/install') {
        const target = new URL(state.redirectUri);
        target.searchParams.set('installation_id', installationId);
        target.searchParams.set('state', stateValue);
        return res.redirect(target.toString());
      }
    }
    return res.type('html').send(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>GitHub App installed</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1>GitHub App installation</h1><p>Return to PocketOps and enter this installation ID to verify the connection:</p><p><strong>${installationId}</strong></p><p>Close this browser window to return to the app.</p></body></html>`);
    } catch (err) { return next(err); }
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
