const { Sequelize } = require('sequelize');
const env = require('../config/env');
const dbConfig = require('../config/database');

function createSequelizeInstance(overrideConfig) {
  const cfg = overrideConfig || dbConfig[env.NODE_ENV] || dbConfig.development;
  if (cfg.url) {
    return new Sequelize(cfg.url, cfg);
  }
  return new Sequelize(cfg);
}

const sequelize = createSequelizeInstance();

module.exports = {
  sequelize,
  createSequelizeInstance,
};
