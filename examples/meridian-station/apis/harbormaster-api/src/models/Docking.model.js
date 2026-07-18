const { DataTypes, Model } = require('sequelize');

class Docking extends Model {
  static init(sequelize) {
    return super.init(
      {
  "docking_id": {
    "type": DataTypes.INTEGER
  },
  "berth_id": {
    "type": DataTypes.TEXT
  },
  "vessel_registry_no": {
    "type": DataTypes.TEXT
  },
  "eta_utc": {
    "type": DataTypes.TEXT
  },
  "departed_utc": {
    "type": DataTypes.TEXT
  },
  "status_code": {
    "type": DataTypes.TEXT,
    "comment": "SCHEDULED | APPROACH | DOCKED | DEPARTED | ABORTED"
  }
},
      {
        sequelize,
        modelName: 'Docking',
        tableName: 'Dockings',
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

module.exports = Docking;