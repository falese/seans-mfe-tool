const mongoose = require('mongoose');
const { Schema } = mongoose;

const ChargeSchema = new Schema(
  {
  "chargeId": {
    "type": String
  },
  "dockingRef": {
    "type": String
  },
  "accountId": {
    "type": String
  },
  "chargeType": {
    "type": String,
    "description": "DOCKING_FEE | MASS_TARIFF | HAZMAT_SURCHARGE | LATE_DEPARTURE"
  },
  "amountCents": {
    "type": Number
  },
  "currency": {
    "type": String
  },
  "status": {
    "type": String,
    "description": "PENDING | PAID | DISPUTED | WAIVED"
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
ChargeSchema.methods = {
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
ChargeSchema.statics = {
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

const Charge = mongoose.model('Charges', ChargeSchema);

// Export both singular and plural forms for compatibility
module.exports = Charge;
module.exports.Charges = Charge;
module.exports.Charge = Charge;