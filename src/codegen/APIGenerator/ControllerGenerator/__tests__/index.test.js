const indexExports = require('../index');
const { ControllerGenerator } = require('../ControllerGenerator');

describe('ControllerGenerator index', () => {
  it('should export ControllerGenerator', () => {
    expect(indexExports.ControllerGenerator).toBeDefined();
  });

  it('should export the correct ControllerGenerator class', () => {
    expect(indexExports.ControllerGenerator).toBe(ControllerGenerator);
  });
});
