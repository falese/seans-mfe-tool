const { ServerRegistry, RspackServer, NodemonServer, BaseServer } = require('../index');

describe('ServerRegistry', () => {
  let consoleLogSpy;
  let originalDebug;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    originalDebug = process.env.DEBUG;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    if (originalDebug) {
      process.env.DEBUG = originalDebug;
    } else {
      delete process.env.DEBUG;
    }
  });

  describe('constructor', () => {
    it('should create empty templates map', () => {
      const registry = new ServerRegistry();
      expect(registry.templates).toBeInstanceOf(Map);
    });

    it('should register default server types', () => {
      const registry = new ServerRegistry();
      expect(registry.templates.get('rspack')).toBe(RspackServer);
      expect(registry.templates.get('nodemon')).toBe(NodemonServer);
    });

    it('should log registered types in debug mode', () => {
      process.env.DEBUG = '1';
      
      const registry = new ServerRegistry();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registered server types'),
        expect.stringContaining('rspack')
      );
    });

    it('should not log in normal mode', () => {
      delete process.env.DEBUG;
      
      new ServerRegistry();
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register new server template', () => {
      const registry = new ServerRegistry();
      class CustomServer extends BaseServer {}
      
      registry.register('custom', CustomServer);
      
      expect(registry.templates.get('custom')).toBe(CustomServer);
    });

    it('should log registration in debug mode', () => {
      process.env.DEBUG = '1';
      const registry = new ServerRegistry();
      class CustomServer extends BaseServer {}
      
      registry.register('custom', CustomServer);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registering server template: custom')
      );
    });

    it('should overwrite existing registration', () => {
      const registry = new ServerRegistry();
      class CustomServer1 extends BaseServer {}
      class CustomServer2 extends BaseServer {}
      
      registry.register('test', CustomServer1);
      expect(registry.templates.get('test')).toBe(CustomServer1);
      
      registry.register('test', CustomServer2);
      expect(registry.templates.get('test')).toBe(CustomServer2);
    });

    it('should accept any class', () => {
      const registry = new ServerRegistry();
      class AnyClass {}
      
      registry.register('any', AnyClass);
      
      expect(registry.templates.get('any')).toBe(AnyClass);
    });
  });

  describe('get', () => {
    it('should retrieve registered server class', () => {
      const registry = new ServerRegistry();
      
      const ServerClass = registry.get('rspack');
      
      expect(ServerClass).toBe(RspackServer);
    });

    it('should throw error for unregistered type', () => {
      const registry = new ServerRegistry();
      
      expect(() => registry.get('unknown')).toThrow(
        'No server template registered for type: unknown'
      );
    });

    it('should log lookup in debug mode', () => {
      process.env.DEBUG = '1';
      const registry = new ServerRegistry();
      
      registry.get('rspack');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Looking for server type: rspack')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available types')
      );
    });

    it('should not log in normal mode', () => {
      delete process.env.DEBUG;
      const registry = new ServerRegistry();
      
      registry.get('rspack');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should retrieve custom registered class', () => {
      const registry = new ServerRegistry();
      class CustomServer extends BaseServer {}
      registry.register('custom', CustomServer);
      
      const ServerClass = registry.get('custom');
      
      expect(ServerClass).toBe(CustomServer);
    });
  });

  describe('Integration', () => {
    it('should support registering and retrieving multiple types', () => {
      const registry = new ServerRegistry();
      class Server1 extends BaseServer {}
      class Server2 extends BaseServer {}
      class Server3 extends BaseServer {}
      
      registry.register('type1', Server1);
      registry.register('type2', Server2);
      registry.register('type3', Server3);
      
      expect(registry.get('type1')).toBe(Server1);
      expect(registry.get('type2')).toBe(Server2);
      expect(registry.get('type3')).toBe(Server3);
    });

    it('should maintain default registrations after custom adds', () => {
      const registry = new ServerRegistry();
      class CustomServer extends BaseServer {}
      
      registry.register('custom', CustomServer);
      
      expect(registry.get('rspack')).toBe(RspackServer);
      expect(registry.get('nodemon')).toBe(NodemonServer);
      expect(registry.get('custom')).toBe(CustomServer);
    });

    it('should allow chaining register calls', () => {
      const registry = new ServerRegistry();
      class Server1 extends BaseServer {}
      class Server2 extends BaseServer {}
      
      registry.register('type1', Server1);
      registry.register('type2', Server2);
      
      expect(registry.templates.size).toBeGreaterThanOrEqual(4); // 2 defaults + 2 custom
    });
  });

  describe('Module Exports', () => {
    it('should export BaseServer', () => {
      expect(BaseServer).toBeDefined();
      expect(typeof BaseServer).toBe('function');
    });

    it('should export ServerRegistry', () => {
      expect(ServerRegistry).toBeDefined();
      expect(typeof ServerRegistry).toBe('function');
    });

    it('should export RspackServer', () => {
      expect(RspackServer).toBeDefined();
      expect(typeof RspackServer).toBe('function');
    });

    it('should export NodemonServer', () => {
      expect(NodemonServer).toBeDefined();
      expect(typeof NodemonServer).toBe('function');
    });
  });
});
