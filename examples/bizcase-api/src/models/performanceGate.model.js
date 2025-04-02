const mongoose = require('mongoose');
const { Schema } = mongoose;

const PerformanceGateSchema = new Schema(
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


// Add schema methods
PerformanceGateSchema.methods = {
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
PerformanceGateSchema.statics = {
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

const PerformanceGate = mongoose.model('PerformanceGates', PerformanceGateSchema);

// Export both singular and plural forms for compatibility
module.exports = PerformanceGate;
module.exports.PerformanceGates = PerformanceGate;
module.exports.PerformanceGate = PerformanceGate;