const mongoose = require('mongoose');

// Import all models
const Pet = require('./Pet.model');
const NewPet = require('./NewPet.model');
const PetList = require('./PetList.model');

// Export both singular and plural forms for each model
module.exports = {
  Pet,
  Pets: Pet,
  NewPet,
  NewPets: NewPet,
  PetList,
  PetLists: PetList
};