const { Sequelize } = require('sequelize');
const config = require('../config/database');

const Player = require('./Player.model');
const NewPlayer = require('./NewPlayer.model');
const Score = require('./Score.model');
const NewScore = require('./NewScore.model');
const LeaderboardEntry = require('./LeaderboardEntry.model');
const Progression = require('./Progression.model');

const env = process.env.NODE_ENV || 'development';
const sequelize = new Sequelize(config[env]);

// Initialize models
Player.init(sequelize);
NewPlayer.init(sequelize);
Score.init(sequelize);
NewScore.init(sequelize);
LeaderboardEntry.init(sequelize);
Progression.init(sequelize);

// Setup associations
Player.associate(sequelize.models);
NewPlayer.associate(sequelize.models);
Score.associate(sequelize.models);
NewScore.associate(sequelize.models);
LeaderboardEntry.associate(sequelize.models);
Progression.associate(sequelize.models);

module.exports = {
  sequelize,
  Sequelize,
  Player,
  NewPlayer,
  Score,
  NewScore,
  LeaderboardEntry,
  Progression
};