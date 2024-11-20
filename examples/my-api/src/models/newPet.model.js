const mongoose = require('mongoose');
const { Schema } = mongoose;

const newPetSchema = new Schema(
  {
  "name": {
    "type": String,
    "required": true
  },
  "tag": {
    "type": String
  },
  "status": {
    "type": String,
    "enum": [
      "available",
      "pending",
      "sold"
    ],
    "default": "available"
  }
},
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

module.exports = mongoose.model('NewPet', newPetSchema);