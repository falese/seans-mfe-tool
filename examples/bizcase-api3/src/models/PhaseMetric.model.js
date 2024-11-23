const mongoose = require('mongoose');
const { Schema } = mongoose;

const PhaseMetricSchema = new Schema(
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


// Add schema methods
PhaseMetricSchema.methods = {
  async toDTO() {
    return {
      id: this._id,
      ...this.toObject(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
};

// Add schema statics
PhaseMetricSchema.statics = {
  async findByIdOrThrow(id) {
    const doc = await this.findById(id);
    if (!doc) throw new Error('Document not found');
    return doc;
  },
  
  async findOneOrThrow(conditions) {
    const doc = await this.findOne(conditions);
    if (!doc) throw new Error('Document not found');
    return doc;
  }
};

const PhaseMetric = mongoose.model('PhaseMetrics', PhaseMetricSchema);

module.exports = PhaseMetric;