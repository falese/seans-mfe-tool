const mongoose = require('mongoose');
const { Schema } = mongoose;

const performanceGateSchema = new Schema(
  {
  "phase": {
    "type": String,
    "required": [
      true,
      "phase is required"
    ]
  },
  "teamSize": {
    "type": Number,
    "required": [
      true,
      "teamSize is required"
    ]
  },
  "teamsOnboarded": {
    "type": Number,
    "required": [
      true,
      "teamsOnboarded is required"
    ]
  },
  "automation": {
    "type": Number,
    "required": [
      true,
      "automation is required"
    ],
    "min": 0,
    "max": 100
  },
  "supportReduction": {
    "type": Number,
    "required": [
      true,
      "supportReduction is required"
    ],
    "min": 0,
    "max": 100
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


const PerformanceGate = mongoose.model('PerformanceGate', performanceGateSchema);

module.exports = PerformanceGate;