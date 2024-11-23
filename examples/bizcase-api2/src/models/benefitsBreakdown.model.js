const mongoose = require('mongoose');
const { Schema } = mongoose;

const benefitsBreakdownSchema = new Schema(
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
  "devTimeSavings": {
    "type": Number,
    "required": [
      true,
      "devTimeSavings is required"
    ]
  },
  "supportEfficiency": {
    "type": Number,
    "required": [
      true,
      "supportEfficiency is required"
    ]
  },
  "timeToMarket": {
    "type": Number,
    "required": [
      true,
      "timeToMarket is required"
    ]
  },
  "totalBenefits": {
    "type": Number,
    "required": [
      true,
      "totalBenefits is required"
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


const BenefitsBreakdown = mongoose.model('BenefitsBreakdown', benefitsBreakdownSchema);

module.exports = BenefitsBreakdown;