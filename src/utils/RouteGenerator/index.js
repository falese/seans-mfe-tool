const { RouteGenerator } = require('./RouteGenerator');

module.exports = {
  generateRoutes: RouteGenerator.generate.bind(RouteGenerator)
};