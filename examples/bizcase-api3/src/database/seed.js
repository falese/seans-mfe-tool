const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function clearCollections() {
    logger.info('Clearing existing data...');
    
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
        await collections[key].deleteMany();
    }
}

async function seedCollection(Model, data) {
    try {
        const result = await Model.create(data);
        logger.info(`Seeded ${Model.modelName} with ${data.length} records`);
        return result;
    } catch (error) {
        logger.error(`Error seeding ${Model.modelName}:`, error);
        throw error;
    }
}

async function seed() {
    try {
        // Ensure we have a database connection
        if (mongoose.connection.readyState !== 1) {
            logger.info('Waiting for database connection...');
            await new Promise(resolve => setTimeout(resolve, 30000));
            if (mongoose.connection.readyState !== 1) {
                throw new Error('Database connection not ready');
            }
        }

        logger.info('Starting database seeding...');
        
        // Clear existing data
        await clearCollections();
        
        // Load all models
        const models = require('../models');
        
        // Get example data from OpenAPI spec
        const exampleData = require('../seeds/examples');
        
        // Seed each model with its example data
        for (const [modelName, Model] of Object.entries(models)) {
            if (exampleData[modelName]) {
                await seedCollection(Model, exampleData[modelName]);
            }
        }

        logger.info('✓ Database seeding completed successfully');
    } catch (error) {
        logger.error('Seeding failed:', error);
        throw error;
    }
}

// Handle direct execution
if (require.main === module) {
    seed()
        .then(() => {
            logger.info('Seeding completed, exiting...');
            process.exit(0);
        })
        .catch(error => {
            logger.error('Seeding failed:', error);
            process.exit(1);
        });
}

module.exports = seed;