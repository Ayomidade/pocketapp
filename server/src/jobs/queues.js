const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const env = require('../config/env');
const { setPushEnqueuer } = require('../modules/notifications/notificationService');

let connection = null;
let notificationQueue = null;
let healthQueue = null;

function initQueues() {
  if (env.NODE_ENV === 'test') return null;

  connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  notificationQueue = new Queue('pocketops-notifications', { connection });
  healthQueue = new Queue('pocketops-health-checks', { connection });

  setPushEnqueuer(async (notificationId) => {
    await notificationQueue.add(
      'deliver-push',
      { notificationId },
      {
        jobId: `push-${notificationId}`,
        attempts: 4,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      }
    );
  });

  return { connection, notificationQueue, healthQueue };
}

async function enqueueServiceHealthCheck(serviceId, { source = 'scheduled', deploymentId = null } = {}) {
  if (!healthQueue) return null;
  return healthQueue.add(
    'probe-service',
    { serviceId, source, deploymentId },
    { attempts: 2, removeOnComplete: 200, removeOnFail: 200 }
  );
}

module.exports = {
  initQueues,
  enqueueServiceHealthCheck,
};
