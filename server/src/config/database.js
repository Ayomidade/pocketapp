const env = require('./env');

const sharedOptions = {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: 10,
    min: 1,
    idle: 10000,
    acquire: 30000,
  },
};

module.exports = {
  development: {
    url: env.DATABASE_URL,
    ...sharedOptions,
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  },
  production: {
    url: env.DATABASE_URL,
    ...sharedOptions,
    dialectOptions: {
      ssl: process.env.DATABASE_SSL === 'false' ? false : { require: true, rejectUnauthorized: false },
    },
  },
};
