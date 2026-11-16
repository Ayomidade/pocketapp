const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const env = require('../config/env');
const logger = require('../utils/logger');
const { Service } = require('../database/models');
const { deliverNotificationPush } = require('../modules/notifications/notificationService');
const { executeHealthCheck } = require('../modules/health/healthService');

function startWorkers() {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const notificationWorker = new Worker(
    'pocketops-notifications',
    async (job) => {
      await deliverNotificationPush(job.data.notificationId);
    },
    { connection, concurrency: 5 }
  );

  const healthWorker = new Worker(
    'pocketops-health-checks',
    async (job) => {
      if (job.name === 'probe-all-services') {
        const services = await Service.findAll({ where: { suspended: false } });
        for (const s of services) {
          await executeHealthCheck(s.id, { source: 'scheduled' });
        }
        return;
      }
      await executeHealthCheck(job.data.serviceId, {
        source: job.data.source || 'scheduled',
        deploymentId: job.data.deploymentId || null,
      });
    },
    { connection, concurrency: 5 }
  );

  notificationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Notification worker job failed');
  });

  healthWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Health worker job failed');
  });

  logger.info('PocketOps BullMQ workers started');
  return { notificationWorker, healthWorker, connection };
}

if (require.main === module) {
  startWorkers();
}

module.exports = { startWorkers };
