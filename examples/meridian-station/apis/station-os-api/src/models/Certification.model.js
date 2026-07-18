const { DataTypes, Model } = require('sequelize');

class Certification extends Model {
  static init(sequelize) {
    return super.init(
      {
  "CertificationId": {
    "type": DataTypes.INTEGER
  },
  "CrewId": {
    "type": DataTypes.INTEGER
  },
  "CertificationCode": {
    "type": DataTypes.TEXT,
    "comment": "EVA | DOCKING_CONTROL | HAZMAT | MEDICAL | FOOD_SAFETY"
  },
  "ExpiresOnUtc": {
    "type": DataTypes.TEXT
  },
  "Status": {
    "type": DataTypes.TEXT,
    "comment": "VALID | EXPIRING | EXPIRED"
  }
},
      {
        sequelize,
        modelName: 'Certification',
        tableName: 'Certifications',
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

module.exports = Certification;