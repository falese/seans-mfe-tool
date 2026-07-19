const { Sequelize } = require('sequelize');
const config = require('../config/database');

const Berth = require('./Berth.model');
const Docking = require('./Docking.model');
const ManifestLine = require('./ManifestLine.model');
const Vessel = require('./Vessel.model');

const env = process.env.NODE_ENV || 'development';
const sequelize = new Sequelize(config[env]);

// Initialize models
Berth.init(sequelize);
Docking.init(sequelize);
ManifestLine.init(sequelize);
Vessel.init(sequelize);

// Setup associations
Berth.associate(sequelize.models);
Docking.associate(sequelize.models);
ManifestLine.associate(sequelize.models);
Vessel.associate(sequelize.models);

module.exports = {
  sequelize,
  Sequelize,
  Berth,
  Docking,
  ManifestLine,
  Vessel
};