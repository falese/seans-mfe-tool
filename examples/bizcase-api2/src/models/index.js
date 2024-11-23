const mongoose = require('mongoose');

// Import all models
const PhaseMetrics = require('./phaseMetrics.model');
const BenefitsBreakdown = require('./benefitsBreakdown.model');
const CumulativeRoi = require('./cumulativeRoi.model');
const PerformanceGate = require('./performanceGate.model');

module.exports = {
  PhaseMetrics,
  BenefitsBreakdown,
  CumulativeRoi,
  PerformanceGate
};