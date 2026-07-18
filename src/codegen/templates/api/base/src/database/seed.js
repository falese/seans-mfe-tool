require('dotenv').config();
const logger = require('../utils/logger');
const database = require('./index');

/**
 * Runs the generated seed set in ./seeds (derived from the OpenAPI spec's
 * example values — replace those files with real fixtures as needed).
 * Used by `npm run db:seed` and by src/index.js when SEED_DATA=true.
 */
async function seed() {
  try {
    await database.connect();
    logger.info('Starting database seed...');

    const seedDatabase = require('./seeds');
    await seedDatabase();

    logger.info('Database seed completed');
    await database.disconnect();
  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seed;
