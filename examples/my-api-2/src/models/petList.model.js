const mongoose = require('mongoose');
const { Schema } = mongoose;

const petListSchema = new Schema(
  {},
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


const PetList = mongoose.model('PetList', petListSchema);

module.exports = PetList;