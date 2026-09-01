const { RouteGenerator } = require('../RouteGenerator');

// Mock RouteGenerator before importing index
jest.mock('../RouteGenerator', () => ({
  RouteGenerator: {
    generate: jest.fn().mockResolvedValue(undefined)
  }
}));

const routeGeneratorExports = require('../index');

describe('RouteGenerator index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export generateRoutes function', () => {
    expect(routeGeneratorExports).toHaveProperty('generateRoutes');
    expect(typeof routeGeneratorExports.generateRoutes).toBe('function');
  });

  it('should call RouteGenerator.generate when invoked', async () => {
    const testDir = '/test/dir';
    const testSpec = { paths: {} };
    
    await routeGeneratorExports.generateRoutes(testDir, testSpec);
    
    expect(RouteGenerator.generate).toHaveBeenCalledWith(testDir, testSpec);
  });
});
