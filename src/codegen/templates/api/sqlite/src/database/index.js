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
  disconnectDatabase
};
