const db = require('../../models');
const BerthSeed = require('./Berth.seed');
const DockingSeed = require('./Docking.seed');
const ManifestLineSeed = require('./ManifestLine.seed');
const VesselSeed = require('./Vessel.seed');

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    await db.sequelize.sync({ force: true });
    
    // Seed all models
    await db.Berth.bulkCreate(BerthSeed);
    await db.Docking.bulkCreate(DockingSeed);
    await db.ManifestLine.bulkCreate(ManifestLineSeed);
    await db.Vessel.bulkCreate(VesselSeed);
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;