require('dotenv').config();
const logger = require('../utils/logger');

/**
 * This is a placeholder file that gets replaced by the database-specific
 * implementation (MongoDB or SQLite) during project creation.
 * 
 * The actual implementation will be copied from either:
 * - templates/api/mongodb/src/database/index.js
 * - templates/api/sqlite/src/database/index.js
 */

const database = {
    connect: async function() {
        throw new Error('Database implementation not found. Did you specify a database type?');
    },

    disconnect: async function() {
        throw new Error('Database implementation not found. Did you specify a database type?');
    }
};

// Handle cleanup
process.on('SIGINT', async () => {
    try {
        await database.disconnect();
    } catch (error) {
        logger.error('Error during database shutdown:', error);
    }
    process.exit(0);
});

module.exports = database;