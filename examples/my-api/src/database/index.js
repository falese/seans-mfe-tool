// src/templates/api/mongodb/src/database/index.js

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../config/database');
const logger = require('../utils/logger');

let mongod = null;

async function connectDatabase() {
  const env = process.env.NODE_ENV || 'development';
  const dbConfig = config[env];

  try {
    if (dbConfig.useMemoryServer) {
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      logger.info('MongoDB Memory Server started at:', uri);
      await mongoose.connect(uri, dbConfig.options);
    } else {
      if (!dbConfig.url) {
        throw new Error('MongoDB URI is not configured');
      }
      await mongoose.connect(dbConfig.url, dbConfig.options);
    }

    logger.info('Database connection established successfully');

    mongoose.connection.on('disconnected', () => {
      logger.warn('Lost MongoDB connection');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Reconnected to MongoDB');
    });

  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
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
  connectDatabase,
  disconnectDatabase
};
