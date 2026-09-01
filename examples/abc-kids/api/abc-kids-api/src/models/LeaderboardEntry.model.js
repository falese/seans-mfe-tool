const { DataTypes, Model } = require('sequelize');

class LeaderboardEntry extends Model {
  static init(sequelize) {
    return super.init(
      {
  "playerId": {
    "type": DataTypes.TEXT,
    "allowNull": false
  },
  "displayName": {
    "type": DataTypes.TEXT,
    "allowNull": false
  },
  "avatar": {
    "type": DataTypes.TEXT
  },
  "bestPoints": {
    "type": DataTypes.INTEGER,
    "allowNull": false
  },
  "bestGameId": {
    "type": DataTypes.TEXT
  },
  "gamesPlayed": {
    "type": DataTypes.INTEGER
  }
},
      {
        sequelize,
        modelName: 'LeaderboardEntry',
        tableName: 'LeaderboardEntrys',
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

module.exports = LeaderboardEntry;