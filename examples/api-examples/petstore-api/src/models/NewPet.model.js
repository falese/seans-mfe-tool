const mongoose = require('mongoose');
const { Schema } = mongoose;

const NewPetSchema = new Schema(
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


// Add schema methods
NewPetSchema.methods = {
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
NewPetSchema.statics = {
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

const NewPet = mongoose.model('NewPets', NewPetSchema);

// Export both singular and plural forms for compatibility
module.exports = NewPet;
module.exports.NewPets = NewPet;
module.exports.NewPet = NewPet;