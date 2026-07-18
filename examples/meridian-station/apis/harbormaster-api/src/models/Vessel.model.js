const { DataTypes, Model } = require('sequelize');

class Vessel extends Model {
  static init(sequelize) {
    return super.init(
      {
  "vessel_registry_no": {
    "type": DataTypes.TEXT
  },
  "vessel_name": {
    "type": DataTypes.TEXT
  },
  "operator_name": {
    "type": DataTypes.TEXT
  },
  "max_capacity_kg": {
    "type": DataTypes.DECIMAL(10, 2)
  }
},
      {
        sequelize,
        modelName: 'Vessel',
        tableName: 'Vessels',
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

module.exports = Vessel;