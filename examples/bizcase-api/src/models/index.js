const mongoose = require('mongoose');

// Import all models
const PhaseMetric = require('./PhaseMetric.model');
const BenefitsBreakdown = require('./BenefitsBreakdown.model');
const CumulativeRoi = require('./CumulativeRoi.model');
const PerformanceGate = require('./PerformanceGate.model');

// Export both singular and plural forms for each model
module.exports = {
  PhaseMetric,
  PhaseMetrics: PhaseMetric,
  BenefitsBreakdown,
  BenefitsBreakdowns: BenefitsBreakdown,
  CumulativeRoi,
  CumulativeRois: CumulativeRoi,
  PerformanceGate,
  PerformanceGates: PerformanceGate
};