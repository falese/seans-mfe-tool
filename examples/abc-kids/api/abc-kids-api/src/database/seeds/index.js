const db = require('../../models');
const PlayerSeed = require('./Player.seed');
const NewPlayerSeed = require('./NewPlayer.seed');
const ScoreSeed = require('./Score.seed');
const NewScoreSeed = require('./NewScore.seed');
const LeaderboardEntrySeed = require('./LeaderboardEntry.seed');
const ProgressionSeed = require('./Progression.seed');

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    await db.sequelize.sync({ force: true });
    
    // Seed all models
    await db.Player.bulkCreate(PlayerSeed);
    await db.NewPlayer.bulkCreate(NewPlayerSeed);
    await db.Score.bulkCreate(ScoreSeed);
    await db.NewScore.bulkCreate(NewScoreSeed);
    await db.LeaderboardEntry.bulkCreate(LeaderboardEntrySeed);
    await db.Progression.bulkCreate(ProgressionSeed);
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;