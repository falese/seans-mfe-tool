const mongoose = require('mongoose');
const { Schema } = mongoose;

const BenefitsBreakdownSchema = new Schema(
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


// Add schema methods
BenefitsBreakdownSchema.methods = {
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
BenefitsBreakdownSchema.statics = {
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

const BenefitsBreakdown = mongoose.model('BenefitsBreakdowns', BenefitsBreakdownSchema);

// Export both singular and plural forms for compatibility
module.exports = BenefitsBreakdown;
module.exports.BenefitsBreakdowns = BenefitsBreakdown;
module.exports.BenefitsBreakdown = BenefitsBreakdown;