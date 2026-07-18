const db = require('../../models');
const ModuleSeed = require('./Module.seed');
const TelemetrySeed = require('./Telemetry.seed');
const CrewSeed = require('./Crew.seed');
const CertificationSeed = require('./Certification.seed');
const PassengerSeed = require('./Passenger.seed');
const VendorSeed = require('./Vendor.seed');
const StallSeed = require('./Stall.seed');

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    await db.sequelize.sync({ force: true });
    
    // Seed all models
    await db.Module.bulkCreate(ModuleSeed);
    await db.Telemetry.bulkCreate(TelemetrySeed);
    await db.Crew.bulkCreate(CrewSeed);
    await db.Certification.bulkCreate(CertificationSeed);
    await db.Passenger.bulkCreate(PassengerSeed);
    await db.Vendor.bulkCreate(VendorSeed);
    await db.Stall.bulkCreate(StallSeed);
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;