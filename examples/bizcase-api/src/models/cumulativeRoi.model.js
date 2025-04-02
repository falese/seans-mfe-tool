const mongoose = require('mongoose');
const { Schema } = mongoose;

const CumulativeRoiSchema = new Schema(
  {
  "year": {
    "type": Number,
    "required": [
      true,
      "year is required"
    ]
  },
  "period": {
    "type": String,
    "required": [
      true,
      "period is required"
    ]
  },
  "costs": {
    "type": Number,
    "required": [
      true,
      "costs is required"
    ]
  },
  "benefits": {
    "type": Number,
    "required": [
      true,
      "benefits is required"
    ]
  },
  "net": {
    "type": Number,
    "required": [
      true,
      "net is required"
    ]
  },
  "cumulativeRoi": {
    "type": Number,
    "required": [
      true,
      "cumulativeRoi is required"
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
CumulativeRoiSchema.methods = {
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
CumulativeRoiSchema.statics = {
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

const CumulativeRoi = mongoose.model('CumulativeRois', CumulativeRoiSchema);

// Export both singular and plural forms for compatibility
module.exports = CumulativeRoi;
module.exports.CumulativeRois = CumulativeRoi;
module.exports.CumulativeRoi = CumulativeRoi;