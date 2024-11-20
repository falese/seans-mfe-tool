const mongoose = require('mongoose');
const { Schema } = mongoose;

const petSchema = new Schema(
  {
  "name": {
    "type": String,
    "required": [
      true,
      "name is required"
    ]
  },
  "status": {
    "type": String,
    "required": [
      true,
      "status is required"
    ],
    "enum": [
      "available",
      "pending",
      "sold"
    ]
  },
  "tag": {
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


const Pet = mongoose.model('Pet', petSchema);

module.exports = Pet;