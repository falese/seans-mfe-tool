const { DataTypes, Model } = require('sequelize');

class Module extends Model {
  static init(sequelize) {
    return super.init(
      {
  "ModuleId": {
    "type": DataTypes.INTEGER
  },
  "ModuleName": {
    "type": DataTypes.TEXT
  },
  "DeckZone": {
    "type": DataTypes.TEXT
  },
  "ModuleType": {
    "type": DataTypes.TEXT,
    "comment": "HABITAT | LIFE_SUPPORT | DOCKING | CONCOURSE | POWER"
  }
},
      {
        sequelize,
        modelName: 'Module',
        tableName: 'Modules',
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

module.exports = Module;