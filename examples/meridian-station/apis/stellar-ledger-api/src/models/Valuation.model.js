const mongoose = require('mongoose');
const { Schema } = mongoose;

const ValuationSchema = new Schema(
  {
  "valuationId": {
    "type": String
  },
  "manifestLineRef": {
    "type": String
  },
  "declaredValueCents": {
    "type": Number
  },
  "currency": {
    "type": String
  },
  "insuranceClass": {
    "type": String,
    "description": "STANDARD | SPECIALIZED | UNINSURABLE"
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
ValuationSchema.methods = {
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
ValuationSchema.statics = {
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

const Valuation = mongoose.model('Valuations', ValuationSchema);

// Export both singular and plural forms for compatibility
module.exports = Valuation;
module.exports.Valuations = Valuation;
module.exports.Valuation = Valuation;