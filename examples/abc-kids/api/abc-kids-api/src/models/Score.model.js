const { DataTypes, Model } = require('sequelize');

class Score extends Model {
  static init(sequelize) {
    return super.init(
      {
  "playerId": {
    "type": DataTypes.TEXT,
    "allowNull": false
  },
  "gameId": {
    "type": DataTypes.TEXT,
    "allowNull": false,
    "comment": "The MFE that recorded it, e.g. flappy"
  },
  "points": {
    "type": DataTypes.INTEGER,
    "allowNull": false
  },
  "achievedAt": {
    "type": DataTypes.DATE
  }
},
      {
        sequelize,
        modelName: 'Score',
        tableName: 'Scores',
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

module.exports = Score;