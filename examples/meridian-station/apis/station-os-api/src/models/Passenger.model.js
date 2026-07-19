const { DataTypes, Model } = require('sequelize');

class Passenger extends Model {
  static init(sequelize) {
    return super.init(
      {
  "PassengerId": {
    "type": DataTypes.INTEGER
  },
  "PassengerName": {
    "type": DataTypes.TEXT
  },
  "DockingNo": {
    "type": DataTypes.INTEGER,
    "comment": "The harbormaster's docking_id"
  },
  "CabinClass": {
    "type": DataTypes.TEXT,
    "comment": "ECONOMY | BUSINESS | STATEROOM"
  },
  "ClearanceStatus": {
    "type": DataTypes.TEXT,
    "comment": "PENDING | CLEARED | FLAGGED"
  }
},
      {
        sequelize,
        modelName: 'Passenger',
        tableName: 'Passengers',
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

module.exports = Passenger;