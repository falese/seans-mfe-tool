const mongoose = require('mongoose');
const { Schema } = mongoose;

const petSchema = new Schema(
  {
  "name": {
    "type": String,
    "required": true
  },
  "status": {
    "type": String,
    "required": true,
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
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('Pet', petSchema);