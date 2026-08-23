// src/templates/api/sqlite/src/database/index.js

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const config = require('../config/database');
const logger = require('../utils/logger');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Ensure data directory exists for SQLite file
if (dbConfig.storage && dbConfig.storage !== ':memory:') {
  const dir = path.dirname(dbConfig.storage);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const sequelize = new Sequelize(dbConfig);

async function connectDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Create the schema outside production.
    //
    // Without this a fresh start is healthy and useless: the connection opens,
    // /health returns 200, and every data endpoint answers 500 "no such table".
    // The sync has to run on the instance the MODELS are registered on —
    // models/index.js constructs its own Sequelize — because syncing the bare
    // instance above defines nothing. Required lazily so this module stays
    // importable by tooling that has no models.
    //
    // Production migrates explicitly (`npm run db:migrate`); sync({ alter })
    // must never touch a production schema.
    if (env !== 'production') {
      const models = require('../models');
      await models.sequelize.sync();
      logger.info('Database schema synchronized', { env });
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

async function disconnectDatabase() {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error while closing database connection:', error);
  }
}

// Clean up on app termination
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

module.exports = {
  sequelize,
  connectDatabase,
  disconnectDatabase,
  // Aliases matching the interface src/index.js consumes (the mongodb
  // variant exports connect/disconnect; both variants must satisfy it).
  connect: connectDatabase,
  disconnect: disconnectDatabase
};
