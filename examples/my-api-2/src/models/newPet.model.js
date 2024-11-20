const mongoose = require('mongoose');
const { Schema } = mongoose;

const newPetSchema = new Schema(
  {
  "name": {
    "type": String,
    "required": [
      true,
      "name is required"
    ]
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


const NewPet = mongoose.model('NewPet', newPetSchema);

module.exports = NewPet;