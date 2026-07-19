const mongoose = require('mongoose');
const { Schema } = mongoose;

const SettlementSchema = new Schema(
  {
  "settlementId": {
    "type": String
  },
  "merchantId": {
    "type": String
  },
  "periodStart": {
    "type": String
  },
  "periodEnd": {
    "type": String
  },
  "grossCents": {
    "type": Number
  },
  "feeCents": {
    "type": Number
  },
  "netCents": {
    "type": Number
  },
  "status": {
    "type": String,
    "description": "OPEN | SETTLED | HELD"
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
SettlementSchema.methods = {
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
SettlementSchema.statics = {
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

const Settlement = mongoose.model('Settlements', SettlementSchema);

// Export both singular and plural forms for compatibility
module.exports = Settlement;
module.exports.Settlements = Settlement;
module.exports.Settlement = Settlement;