const { DataTypes, Model } = require('sequelize');

class NewScore extends Model {
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
  "points": {
    "type": DataTypes.INTEGER,
    "allowNull": false
  }
},
      {
        sequelize,
        modelName: 'NewScore',
        tableName: 'NewScores',
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

module.exports = NewScore;