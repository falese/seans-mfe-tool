const mongoose = require('mongoose');

// Import all models
const PhaseMetric = require('./PhaseMetric.model');
const BenefitsBreakdown = require('./BenefitsBreakdown.model');
const CumulativeRoi = require('./CumulativeRoi.model');
const PerformanceGate = require('./PerformanceGate.model');

// Export all models
module.exports = {
  PhaseMetric,
  BenefitsBreakdown,
  CumulativeRoi,
  PerformanceGate
};