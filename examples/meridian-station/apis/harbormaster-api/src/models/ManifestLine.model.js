const { DataTypes, Model } = require('sequelize');

class ManifestLine extends Model {
  static init(sequelize) {
    return super.init(
      {
  "line_id": {
    "type": DataTypes.INTEGER
  },
  "docking_id": {
    "type": DataTypes.INTEGER
  },
  "sku": {
    "type": DataTypes.TEXT
  },
  "description": {
    "type": DataTypes.TEXT
  },
  "qty": {
    "type": DataTypes.INTEGER
  },
  "declared_mass_kg": {
    "type": DataTypes.DECIMAL(10, 2)
  },
  "hazard_class": {
    "type": DataTypes.TEXT,
    "comment": "NONE | CRYO | CORROSIVE | RADIOLOGICAL | BIO"
  }
},
      {
        sequelize,
        modelName: 'ManifestLine',
        tableName: 'ManifestLines',
        timestamps: true,
        underscored: true,
        
        // Add hooks
        hooks: {
          beforeValidate: (instance) => {
            // Add any pre-validation logic
          },
          beforeCreate: (instance) => {
            // Add any pre-create logic
          }
        },
        
        // Add instance methods
        instanceMethods: {
          toDTO() {
            const values = this.get();
            return {
              ...values,
              createdAt: this.createdAt,
              updatedAt: this.updatedAt
            };
          }
        }
      }
    );
  }

  // Define associations
  static associate(models) {
    // No associations defined
  }
}

module.exports = ManifestLine;