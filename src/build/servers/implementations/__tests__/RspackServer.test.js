const { RspackServer } = require('../RspackServer');
const { BaseServer } = require('../../BaseServer');
const { RspackDevServer } = require('@rspack/dev-server');
const chalk = require('chalk');

jest.mock('@rspack/dev-server');
jest.mock('chalk', () => ({
  green: jest.fn((msg) => msg),
  yellow: jest.fn((msg) => msg),
  red: jest.fn((msg) => msg)
}));

describe('RspackServer', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let mockDevServer;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock RspackDevServer
    mockDevServer = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn((callback) => callback())
    };
    RspackDevServer.mockImplementation(() => mockDevServer);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should extend BaseServer', () => {
      const server = new RspackServer({}, '/test/context');
      expect(server).toBeInstanceOf(BaseServer);
    });

    it('should initialize with null server', () => {
      const server = new RspackServer({}, '/test/context');
      expect(server.server).toBeNull();
    });

    it('should pass options to BaseServer', () => {
      const options = { port: 4000, compiler: {} };
      const server = new RspackServer(options, '/test/context');
      expect(server.port).toBe(4000);
      expect(server.context).toBe('/test/context');
    });
  });

  describe('start', () => {
    it('should create and start RspackDevServer', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler, port: 3000 };
      const server = new RspackServer(options, '/test/context');

      await server.start();

      expect(RspackDevServer).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 3000,
          hot: true
        }),
        mockCompiler
      );
      expect(mockDevServer.start).toHaveBeenCalled();
    });

    it('should use custom port from options', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler, port: 5000 };
      const server = new RspackServer(options, '/test/context');

      await server.start();

      expect(RspackDevServer).toHaveBeenCalledWith(
        expect.objectContaining({ port: 5000 }),
        mockCompiler
      );
    });

    it('should configure client overlay for errors only', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');

      await server.start();

      expect(RspackDevServer).toHaveBeenCalledWith(
        expect.objectContaining({
          client: {
            overlay: {
              errors: true,
              warnings: false
            },
            progress: true
          }
        }),
        mockCompiler
      );
    });

    it('should enable hot module replacement', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');

      await server.start();

      expect(RspackDevServer).toHaveBeenCalledWith(
        expect.objectContaining({ hot: true }),
        mockCompiler
      );
    });

    it('should configure static file serving', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');

      await server.start();

      expect(RspackDevServer).toHaveBeenCalledWith(
        expect.objectContaining({
          static: {
            directory: '/test/context'
          }
        }),
        mockCompiler
      );
    });

    it('should log success message', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler, port: 3000 };
      const server = new RspackServer(options, '/test/context');
      const showHelpSpy = jest.spyOn(server, 'showHelp').mockImplementation();

      await server.start();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Development server started')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3000')
      );
      expect(showHelpSpy).toHaveBeenCalled();
    });

    it('should store server instance', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');

      await server.start();

      expect(server.server).toBe(mockDevServer);
    });

    it('should handle start errors', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');
      
      mockDevServer.start.mockRejectedValue(new Error('Port already in use'));

      await expect(server.start()).rejects.toThrow('Port already in use');
    });
  });

  describe('stop', () => {
    it('should stop running server', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');
      
      await server.start();
      await server.stop();

      expect(mockDevServer.stop).toHaveBeenCalled();
      expect(server.server).toBeNull();
    });

    it('should do nothing if server not running', async () => {
      const server = new RspackServer({}, '/test/context');
      
      await server.stop();

      expect(mockDevServer.stop).not.toHaveBeenCalled();
    });

    it('should handle stop errors gracefully', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');
      
      mockDevServer.stop = jest.fn((callback) => {
        throw new Error('Stop failed');
      });
      
      await server.start();
      await server.stop();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning'),
        expect.any(Error)
      );
      expect(server.server).toBeNull();
    });

    it('should force cleanup after timeout', async () => {
      jest.useFakeTimers();
      
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');
      
      mockDevServer.stop = jest.fn(() => {}); // Never calls callback
      
      await server.start();
      const stopPromise = server.stop();
      
      jest.advanceTimersByTime(2000);
      await stopPromise;

      expect(server.server).toBeNull();
      
      jest.useRealTimers();
    });

    it('should resolve when stop callback called', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');
      
      mockDevServer.stop = jest.fn((callback) => {
        setTimeout(callback, 100);
      });
      
      await server.start();
      await server.stop();

      expect(server.server).toBeNull();
    });
  });

  describe('Integration', () => {
    it('should support start-stop-start cycle', async () => {
      const mockCompiler = { name: 'test-compiler' };
      const options = { compiler: mockCompiler };
      const server = new RspackServer(options, '/test/context');

      await server.start();
      expect(server.server).not.toBeNull();
      
      await server.stop();
      expect(server.server).toBeNull();
      
      await server.start();
      expect(server.server).not.toBeNull();
    });

    it('should inherit BaseServer keyboard controls', () => {
      const server = new RspackServer({}, '/test/context');
      expect(server.setupProcessHandling).toBeDefined();
      expect(server.handleShutdown).toBeDefined();
      expect(server.restart).toBeDefined();
    });
  });
});
