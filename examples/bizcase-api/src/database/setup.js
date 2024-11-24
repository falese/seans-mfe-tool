const logger = require('../../utils/logger');
const database = require('./index');
const seed = require('./seed');

async function setup() {
    try {
        // Initialize database
        await database.connect();

        // Run seeding if in development
        if (process.env.NODE_ENV === 'development' && process.env.SEED_DATA === 'true') {
            await seed();
        }

        logger.info('Database setup completed successfully');
    } catch (error) {
        logger.error('Database setup failed:', error);
        throw error;
    }
}

// Handle direct execution
if (require.main === module) {
    setup()
        .then(() => {
            logger.info('Setup completed, exiting...');
            process.exit(0);
        })
        .catch(error => {
            logger.error('Setup failed:', error);
            process.exit(1);
        });
}

module.exports = setup;