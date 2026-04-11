const mongoose = require('mongoose');
const Models = require('../../models');
const PhaseMetricSeed = require('./PhaseMetric.seed');
const BenefitsBreakdownSeed = require('./BenefitsBreakdown.seed');
const CumulativeRoiSeed = require('./CumulativeRoi.seed');
const PerformanceGateSeed = require('./PerformanceGate.seed');

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    const collections = Object.values(mongoose.connection.collections);
    for (const collection of collections) {
      await collection.deleteMany();
    }
    
    // Seed all models
    await Models.PhaseMetrics.insertMany(PhaseMetricSeed);
    await Models.BenefitsBreakdown.insertMany(BenefitsBreakdownSeed);
    await Models.CumulativeRoi.insertMany(CumulativeRoiSeed);
    await Models.PerformanceGate.insertMany(PerformanceGateSeed);
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;