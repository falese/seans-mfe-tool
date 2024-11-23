const { DatabaseGenerator } = require('./databaseGenerator');
const { ControllerGenerator } = require('./controllerGenerator');
const { generateRoutes } = require('./routeGenerator');

module.exports = {
  DatabaseGenerator,
  ControllerGenerator,
  generateRoutes
};