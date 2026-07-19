const { DataTypes, Model } = require('sequelize');

class Stall extends Model {
  static init(sequelize) {
    return super.init(
      {
  "StallId": {
    "type": DataTypes.INTEGER
  },
  "VendorId": {
    "type": DataTypes.INTEGER
  },
  "ConcourseZone": {
    "type": DataTypes.TEXT
  },
  "StallNo": {
    "type": DataTypes.TEXT
  },
  "LeaseCredits": {
    "type": DataTypes.DECIMAL(10, 2),
    "comment": "Decimal credits per period — integer cents never made it over the wall from finance"
  }
},
      {
        sequelize,
        modelName: 'Stall',
        tableName: 'Stalls',
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

module.exports = Stall;