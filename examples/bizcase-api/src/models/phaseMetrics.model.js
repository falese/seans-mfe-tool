const mongoose = require('mongoose');
const { Schema } = mongoose;

const phaseMetricsSchema = new Schema(
  {
  "phaseId": {
    "type": String,
    "required": [
      true,
      "phaseId is required"
    ],
    "enum": [
      "current",
      "phase1",
      "phase2",
      "phase3",
      "phase4",
      "steady"
    ]
  },
  "teamSize": {
    "type": Number,
    "required": [
      true,
      "teamSize is required"
    ]
  },
  "newHires": {
    "type": Number,
    "required": [
      true,
      "newHires is required"
    ]
  },
  "personnelCost": {
    "type": Number,
    "required": [
      true,
      "personnelCost is required"
    ]
  },
  "transitionCost": {
    "type": Number,
    "required": [
      true,
      "transitionCost is required"
    ]
  },
  "totalCost": {
    "type": Number,
    "required": [
      true,
      "totalCost is required"
    ]
  },
  "benefitsRealized": {
    "type": Number,
    "required": [
      true,
      "benefitsRealized is required"
    ],
    "min": 0,
    "max": 100
  },
  "quarterBenefits": {
    "type": Number,
    "required": [
      true,
      "quarterBenefits is required"
    ]
  },
  "quarterRoi": {
    "type": Number,
    "required": [
      true,
      "quarterRoi is required"
    ]
  }
},
  { 
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Add schema validations


const PhaseMetrics = mongoose.model('PhaseMetrics', phaseMetricsSchema);

module.exports = PhaseMetrics;