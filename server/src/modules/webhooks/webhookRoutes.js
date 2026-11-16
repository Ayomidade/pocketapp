const crypto = require('crypto');
const express = require('express');
const env = require('../../config/env');
const { verifyGithubSignature } = require('../../utils/crypto');
const { GithubInstallation, AuthorizedRepository, Service, Deployment } = require('../../database/models');
const { emitNotification } = require('../notifications/notificationService');
const { enqueueServiceHealthCheck } = require('../../jobs/queues');
const { UnauthorizedError } = require('../../utils/errors');

const router = express.Router();

router.post('/github', async (req, res, next) => {
  try {
    const sig = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (env.GITHUB_WEBHOOK_SECRET && !verifyGithubSignature(rawBody, sig, env.GITHUB_WEBHOOK_SECRET)) {
      throw new UnauthorizedError('Invalid GitHub webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
    }

    const event = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'] || crypto.randomUUID();
    const payload = req.body || {};

    if (event === 'installation' && payload.installation?.id) {
      const inst = await GithubInstallation.findOne({
        where: { installationId: payload.installation.id },
      });
      if (inst) {
        if (payload.action === 'deleted') {
          await inst.update({ status: 'removed' });
          await AuthorizedRepository.update({ active: false }, { where: { installationId: inst.id } });
        } else if (payload.action === 'suspend') {
          await inst.update({ status: 'suspended' });
        } else if (payload.action === 'unsuspend') {
          await inst.update({ status: 'verified' });
        }
      }
    }

    if (event === 'check_suite' && payload.check_suite?.conclusion === 'failure' && payload.repository?.id) {
      const repo = await AuthorizedRepository.findOne({ where: { githubRepoId: payload.repository.id } });
      if (repo) {
        await emitNotification({
          userId: repo.userId,
          eventType: 'pr_check',
          severity: 'warning',
          title: `CI checks failed on ${repo.fullName}`,
          body: `Branch ${payload.check_suite.head_branch || 'unknown'} reported failed check suite`,
          deepLink: `pocketops://repositories/${repo.id}`,
          dedupKey: `gh:${deliveryId}`,
          resourceType: 'repository',
          resourceId: repo.id,
        });
      }
    }

    res.status(202).json({ accepted: true, event, deliveryId });
  } catch (err) {
    next(err);
  }
});

router.post('/render', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const renderServiceId = payload.data?.serviceId || payload.serviceId;
    const renderDeployId = payload.data?.id || payload.deployId;
    const eventType = payload.type || payload.event;

    if (renderServiceId) {
      const service = await Service.findOne({ where: { renderServiceId } });
      if (service) {
        if (renderDeployId) {
          const [dep] = await Deployment.findOrCreate({
            where: { serviceId: service.id, renderDeployId },
            defaults: {
              id: crypto.randomUUID(),
              serviceId: service.id,
              renderDeployId,
              status: eventType === 'deploy_ended' ? payload.data?.status || 'live' : 'build_in_progress',
              triggerSource: 'webhook',
              startedAt: new Date(),
            },
          });
          if (payload.data?.status) {
            await dep.update({ status: payload.data.status, finishedAt: new Date() });
          }
          if (['build_failed', 'update_failed'].includes(payload.data?.status)) {
            await emitNotification({
              userId: service.userId,
              eventType: 'deploy_failure',
              severity: 'critical',
              title: `Deployment failed for ${service.name}`,
              body: `Render deployment ${renderDeployId} ended with ${payload.data.status}`,
              deepLink: `pocketops://services/${service.id}`,
              dedupKey: `deploy:${renderDeployId}:${payload.data.status}`,
              resourceType: 'service',
              resourceId: service.id,
            });
          } else if (payload.data?.status === 'live') {
            await enqueueServiceHealthCheck(service.id, { source: 'post_deploy', deploymentId: dep.id });
          }
        }
      }
    }

    res.status(202).json({ accepted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
