const { DataTypes, Model } = require('sequelize');

class Berth extends Model {
  static init(sequelize) {
    return super.init(
      {
  "berth_id": {
    "type": DataTypes.TEXT
  },
  "berth_class": {
    "type": DataTypes.TEXT,
    "comment": "light_personnel | medium_freight | heavy_bulk"
  },
  "occupied_flag": {
    "type": DataTypes.INTEGER,
    "comment": "0 or 1 — booleans were added to the schema language after this system shipped"
  },
  "max_mass_kg": {
    "type": DataTypes.DECIMAL(10, 2)
  },
  "current_docking_id": {
    "type": DataTypes.INTEGER
  }
},
      {
        sequelize,
        modelName: 'Berth',
        tableName: 'Berths',
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

module.exports = Berth;