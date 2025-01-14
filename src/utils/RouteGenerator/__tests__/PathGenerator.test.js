// src/utils/RouteGenerator/__tests__/PathGenerator.test.js
const { PathGenerator } = require('../generators/PathGenerator');

describe('PathGenerator', () => {
  it('should generate path content', () => {
    const paths = {
      '/users': {
        get: {
          operationId: 'getUsers'
        }
      }
    };
    
    const { routes } = PathGenerator.generatePathContent(paths, 'users', {});
    
    expect(routes[0]).toContain('router');
  });
});