// src/commands/__tests__/build.test.js
const { buildCommand } = require('../build');
const { BuildManager } = require('../../build/BuildManager');

jest.mock('../../build/BuildManager');

describe('Build Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BuildManager.prototype.initialize = jest.fn().mockResolvedValue();
    BuildManager.prototype.build = jest.fn().mockResolvedValue();
    BuildManager.prototype.serve = jest.fn().mockResolvedValue();
  });

  it('should execute build process', async () => {
    const options = {
      name: 'test-app',
      type: 'remote',
      mode: 'production'
    };
    await buildCommand(options);
    
    expect(BuildManager.prototype.initialize).toHaveBeenCalled();
    expect(BuildManager.prototype.build).toHaveBeenCalled();
  });

  it('should start development server when serve option is true', async () => {
    const options = {
      name: 'test-app',
      type: 'remote',
      mode: 'development',
      serve: true
    };
    await buildCommand(options);
    
    expect(BuildManager.prototype.serve).toHaveBeenCalled();
  });
});
