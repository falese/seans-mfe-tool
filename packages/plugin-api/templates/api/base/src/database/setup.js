require('dotenv').config();
const logger = require('../utils/logger');
const database = require('./index');

/**
 * This is a placeholder file that gets replaced by the database-specific
 * implementation during project creation.
 */
async function setup() {
    try {
        await database.connect();
        
        if (process.env.NODE_ENV === 'development' && process.env.SEED_DATA === 'true') {
            logger.info('Development mode: Seeding enabled');
            const seed = require('./seed');
            await seed();
        }
        
        logger.info('Database setup completed');
    } catch (error) {
        logger.error('Database setup failed:', error);
        throw error;
    }
}

if (require.main === module) {
    setup()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = setup;