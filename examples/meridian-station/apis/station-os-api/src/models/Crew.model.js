const { DataTypes, Model } = require('sequelize');

class Crew extends Model {
  static init(sequelize) {
    return super.init(
      {
  "CrewId": {
    "type": DataTypes.INTEGER
  },
  "CrewMemberName": {
    "type": DataTypes.TEXT
  },
  "Section": {
    "type": DataTypes.TEXT,
    "comment": "OPERATIONS | MEDICAL | ENGINEERING | HOSPITALITY"
  },
  "DutyStatus": {
    "type": DataTypes.TEXT,
    "comment": "ON_DUTY | OFF_DUTY | LEAVE"
  },
  "BerthAssignment": {
    "type": DataTypes.TEXT
  }
},
      {
        sequelize,
        modelName: 'Crew',
        tableName: 'Crews',
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

module.exports = Crew;