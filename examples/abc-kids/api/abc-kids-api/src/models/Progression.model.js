const { DataTypes, Model } = require('sequelize');

class Progression extends Model {
  static init(sequelize) {
    return super.init(
      {
  "playerId": {
    "type": DataTypes.TEXT,
    "allowNull": false
  },
  "gameId": {
    "type": DataTypes.TEXT,
    "allowNull": false
  },
  "level": {
    "type": DataTypes.INTEGER,
    "allowNull": false
  },
  "starsEarned": {
    "type": DataTypes.INTEGER
  },
  "lastPlayedAt": {
    "type": DataTypes.DATE
  }
},
      {
        sequelize,
        modelName: 'Progression',
        tableName: 'Progressions',
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

module.exports = Progression;