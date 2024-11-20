const mongoose = require('mongoose');
const { Schema } = mongoose;

const petListSchema = new Schema(
  {},
  { 
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('PetList', petListSchema);