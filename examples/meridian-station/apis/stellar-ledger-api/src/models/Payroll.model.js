const mongoose = require('mongoose');
const { Schema } = mongoose;

const PayrollSchema = new Schema(
  {
  "payrollId": {
    "type": String
  },
  "crewRef": {
    "type": String
  },
  "periodEnd": {
    "type": String
  },
  "grossCents": {
    "type": Number
  },
  "status": {
    "type": String,
    "description": "SCHEDULED | PAID | HELD"
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
PayrollSchema.methods = {
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
PayrollSchema.statics = {
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

const Payroll = mongoose.model('Payrolls', PayrollSchema);

// Export both singular and plural forms for compatibility
module.exports = Payroll;
module.exports.Payrolls = Payroll;
module.exports.Payroll = Payroll;