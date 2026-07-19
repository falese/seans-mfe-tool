const mongoose = require('mongoose');
const { Schema } = mongoose;

const AccountSchema = new Schema(
  {
  "accountId": {
    "type": String
  },
  "displayName": {
    "type": String
  },
  "accountType": {
    "type": String,
    "description": "OPERATOR | MERCHANT | CREW"
  },
  "standing": {
    "type": String,
    "description": "GOOD | DELINQUENT | FROZEN"
  },
  "balanceCents": {
    "type": Number
  },
  "currency": {
    "type": String
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
AccountSchema.methods = {
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
AccountSchema.statics = {
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

const Account = mongoose.model('Accounts', AccountSchema);

// Export both singular and plural forms for compatibility
module.exports = Account;
module.exports.Accounts = Account;
module.exports.Account = Account;