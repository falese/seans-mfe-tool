const mongoose = require('mongoose');
const { Schema } = mongoose;

const schemaVersionSchema = new Schema({
  version: {
    type: Number,
    required: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  models: [{
    name: String,
    version: Number
  }]
}, {
  timestamps: true,
  collection: 'schema_versions'
});

// Add methods for version management
schemaVersionSchema.statics.getCurrentVersion = async function() {
  const latest = await this.findOne().sort({ version: -1 });
  return latest ? latest.version : 0;
};

schemaVersionSchema.statics.recordVersion = async function(version, description, models) {
  return this.create({
    version,
    description,
    models
  });
};

const SchemaVersion = mongoose.model('SchemaVersion', schemaVersionSchema);

module.exports = SchemaVersion;