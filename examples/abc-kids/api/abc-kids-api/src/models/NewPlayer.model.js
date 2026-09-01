const { DataTypes, Model } = require('sequelize');

class NewPlayer extends Model {
  static init(sequelize) {
    return super.init(
      {
  "displayName": {
    "type": DataTypes.TEXT,
    "allowNull": false
  },
  "avatar": {
    "type": DataTypes.TEXT
  }
},
      {
        sequelize,
        modelName: 'NewPlayer',
        tableName: 'NewPlayers',
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

module.exports = NewPlayer;