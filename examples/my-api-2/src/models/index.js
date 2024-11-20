const mongoose = require('mongoose');

// Import all models
const Pet = require('./pet.model');
const NewPet = require('./newPet.model');
const PetList = require('./petList.model');

module.exports = {
  Pet,
  NewPet,
  PetList
};