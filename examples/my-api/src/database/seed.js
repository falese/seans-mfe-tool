// src/templates/api/mongodb/src/database/seed.js

const logger = require('../utils/logger');
const { connectDatabase, disconnectDatabase } = require('./index');

async function seedDatabase() {
  try {
    await connectDatabase();
    logger.info('Starting database seed...');

    // Import all models
    const models = require('../models');

    // Add your seed data here
    // Example:
    await models.Pet.create({ 
      name: 'Pet User',
      status: 'available'
    
    });

    logger.info('Database seed completed');
    await disconnectDatabase();
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
