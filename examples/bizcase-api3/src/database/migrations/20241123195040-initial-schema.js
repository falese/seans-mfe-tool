const mongoose = require('mongoose');
const Models = require('../../models');
const SchemaVersion = require('../../models/schemaVersion.model');

// Define the models and their initial versions
const initialSchemas = {
  "PhaseMetric": {
    "fields": [
      "phaseId",
      "teamSize",
      "newHires",
      "personnelCost",
      "transitionCost",
      "totalCost",
      "benefitsRealized",
      "quarterBenefits",
      "quarterRoi"
    ],
    "version": 1
  },
  "BenefitsBreakdown": {
    "fields": [
      "phaseId",
      "devTimeSavings",
      "supportEfficiency",
      "timeToMarket",
      "totalBenefits"
    ],
    "version": 1
  },
  "CumulativeRoi": {
    "fields": [
      "year",
      "period",
      "costs",
      "benefits",
      "net",
      "cumulativeRoi"
    ],
    "version": 1
  },
  "PerformanceGate": {
    "fields": [
      "phase",
      "teamSize",
      "teamsOnboarded",
      "automation",
      "supportReduction"
    ],
    "version": 1
  }
};

async function up() {
  console.log('Applying initial schema version...');

  // Record the initial schema version
  await SchemaVersion.recordVersion(1, 'Initial schema creation', 
    Object.keys(initialSchemas).map(model => ({
      name: model,
      version: 1
    }))
  );

  console.log('✓ Initial schema version applied');
}

async function down() {
  console.log('Rolling back initial schema version...');
  
  // Drop all collections except schema versions
  const collections = Object.keys(initialSchemas);
  for (const collection of collections) {
    await mongoose.connection.collection(collection).drop();
  }

  // Remove version record
  await SchemaVersion.deleteOne({ version: 1 });
  
  console.log('✓ Initial schema version rolled back');
}

module.exports = {
  version: 1,
  description: 'Initial schema creation',
  up,
  down
};