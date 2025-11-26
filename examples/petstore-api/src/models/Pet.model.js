const mongoose = require('mongoose');
const { Schema } = mongoose;

const PetSchema = new Schema(
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


// Add schema methods
PetSchema.methods = {
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
PetSchema.statics = {
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

const Pet = mongoose.model('Pets', PetSchema);

// Export both singular and plural forms for compatibility
module.exports = Pet;
module.exports.Pets = Pet;
module.exports.Pet = Pet;