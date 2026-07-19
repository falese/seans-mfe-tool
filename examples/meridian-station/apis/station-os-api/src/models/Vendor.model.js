const { DataTypes, Model } = require('sequelize');

class Vendor extends Model {
  static init(sequelize) {
    return super.init(
      {
  "VendorId": {
    "type": DataTypes.INTEGER
  },
  "VendorName": {
    "type": DataTypes.TEXT
  },
  "ConcourseZone": {
    "type": DataTypes.TEXT
  },
  "CuisineOrCategory": {
    "type": DataTypes.TEXT
  },
  "LicenseStatus": {
    "type": DataTypes.TEXT,
    "comment": "ACTIVE | PROBATION | SUSPENDED"
  }
},
      {
        sequelize,
        modelName: 'Vendor',
        tableName: 'Vendors',
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

module.exports = Vendor;