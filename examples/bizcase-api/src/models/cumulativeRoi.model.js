const mongoose = require('mongoose');
const { Schema } = mongoose;

const cumulativeRoiSchema = new Schema(
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


const CumulativeRoi = mongoose.model('CumulativeRoi', cumulativeRoiSchema);

module.exports = CumulativeRoi;