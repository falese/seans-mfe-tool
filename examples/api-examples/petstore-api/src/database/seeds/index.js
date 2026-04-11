const mongoose = require('mongoose');
const Models = require('../../models');
const PetSeed = require('./Pet.seed');
const NewPetSeed = require('./NewPet.seed');

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    const collections = Object.values(mongoose.connection.collections);
    for (const collection of collections) {
      await collection.deleteMany();
    }
    
    // Seed all models
    await Models.Pet.insertMany(PetSeed);
    await Models.NewPet.insertMany(NewPetSeed);
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;