const mongoose = require('mongoose');
const Models = require('../../models');
const AccountSeed = require('./Account.seed');
const ChargeSeed = require('./Charge.seed');
const ValuationSeed = require('./Valuation.seed');
const SettlementSeed = require('./Settlement.seed');
const PayrollSeed = require('./Payroll.seed');

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    const collections = Object.values(mongoose.connection.collections);
    for (const collection of collections) {
      await collection.deleteMany();
    }
    
    // Seed all models
    await Models.Account.insertMany(AccountSeed);
    await Models.Charge.insertMany(ChargeSeed);
    await Models.Valuation.insertMany(ValuationSeed);
    await Models.Settlement.insertMany(SettlementSeed);
    await Models.Payroll.insertMany(PayrollSeed);
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;