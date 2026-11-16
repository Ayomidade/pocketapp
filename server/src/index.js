const env = require('./config/env');
const logger = require('./utils/logger');
const { sequelize } = require('./database/models');
const { initQueues } = require('./jobs/queues');
const { createApp } = require('./app');

async function main() {
  await sequelize.authenticate();
  logger.info('PostgreSQL connection established');

  initQueues();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'PocketOps API server listening');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start PocketOps API server');
  process.exit(1);
});
