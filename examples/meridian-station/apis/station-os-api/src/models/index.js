const { Sequelize } = require('sequelize');
const config = require('../config/database');

const Module = require('./Module.model');
const Telemetry = require('./Telemetry.model');
const Crew = require('./Crew.model');
const Certification = require('./Certification.model');
const Passenger = require('./Passenger.model');
const Vendor = require('./Vendor.model');
const Stall = require('./Stall.model');

const env = process.env.NODE_ENV || 'development';
const sequelize = new Sequelize(config[env]);

// Initialize models
Module.init(sequelize);
Telemetry.init(sequelize);
Crew.init(sequelize);
Certification.init(sequelize);
Passenger.init(sequelize);
Vendor.init(sequelize);
Stall.init(sequelize);

// Setup associations
Module.associate(sequelize.models);
Telemetry.associate(sequelize.models);
Crew.associate(sequelize.models);
Certification.associate(sequelize.models);
Passenger.associate(sequelize.models);
Vendor.associate(sequelize.models);
Stall.associate(sequelize.models);

module.exports = {
  sequelize,
  Sequelize,
  Module,
  Telemetry,
  Crew,
  Certification,
  Passenger,
  Vendor,
  Stall
};