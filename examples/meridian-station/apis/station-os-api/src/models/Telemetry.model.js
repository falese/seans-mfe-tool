const { DataTypes, Model } = require('sequelize');

class Telemetry extends Model {
  static init(sequelize) {
    return super.init(
      {
  "ReadingId": {
    "type": DataTypes.INTEGER
  },
  "ModuleId": {
    "type": DataTypes.INTEGER
  },
  "MetricKind": {
    "type": DataTypes.TEXT,
    "comment": "O2_PARTIAL_PRESSURE | CO2_PPM | TEMP_C | POWER_KW | PRESSURE_KPA"
  },
  "MetricValue": {
    "type": DataTypes.DECIMAL(10, 2)
  },
  "RecordedAtUtc": {
    "type": DataTypes.TEXT
  },
  "AlertLevel": {
    "type": DataTypes.TEXT,
    "comment": "NOMINAL | WATCH | CRITICAL"
  }
},
      {
        sequelize,
        modelName: 'Telemetry',
        tableName: 'Telemetrys',
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

module.exports = Telemetry;