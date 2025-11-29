const { NodemonServer } = require('../NodemonServer');
const { BaseServer } = require('../../BaseServer');
const nodemon = require('nodemon');
const chalk = require('chalk');
const { spawn } = require('child_process');

jest.mock('nodemon');
jest.mock('child_process');
jest.mock('../../BaseServer', () => {
  const actual = jest.requireActual('../../BaseServer');
  return {
    ...actual,
    BaseServer: class MockBaseServer extends actual.BaseServer {
      setupProcessHandling() {
        // Override to prevent BaseServer from setting up its own handlers
      }
    }
  };
});
jest.mock('chalk', () => ({
  green: jest.fn((msg) => msg),
  blue: jest.fn((msg) => msg),
  yellow: jest.fn((msg) => msg),
  red: jest.fn((msg) => msg),
  gray: jest.fn((msg) => msg)
}));

describe('NodemonServer', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let mockNodemon;
  let originalProcessEnv;
  let processListeners;
  let stdinListeners;
  let processOnSpy;
  let stdinOnSpy;
  let processStdinMock;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    originalProcessEnv = { ...process.env };
    
    // Track process event listeners
    processListeners = {};
    processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (!processListeners[event]) processListeners[event] = [];
      processListeners[event].push(handler);
      return process;
    });
    
    // Mock process.stdin
    stdinListeners = {};
    processStdinMock = {
      isTTY: true,
      setRawMode: jest.fn(),
      setEncoding: jest.fn(),
      on: jest.fn((event, handler) => {
        if (!stdinListeners[event]) stdinListeners[event] = [];
        stdinListeners[event].push(handler);
        return processStdinMock;
      }),
      resume: jest.fn()
    };
    Object.defineProperty(process, 'stdin', {
      value: processStdinMock,
      writable: true,
      configurable: true
    });
    originalProcessEnv = { ...process.env };

    // Mock nodemon with event emitter
    mockNodemon = {
      on: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      once: jest.fn()
    };
    nodemon.mockReturnValue(mockNodemon);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processOnSpy.mockRestore();
    process.env = originalProcessEnv;
  });

  describe('constructor', () => {
    it('should extend BaseServer', () => {
      const server = new NodemonServer({}, '/test/context');
      expect(server).toBeInstanceOf(BaseServer);
    });

    it('should initialize with null nodemon', () => {
      const server = new NodemonServer({}, '/test/context');
      expect(server.nodemon).toBeNull();
    });

    it('should initialize debug mode from options', () => {
      const server = new NodemonServer({ debug: true }, '/test/context');
      expect(server.debugMode).toBe(true);
    });

    it('should default debug mode to false', () => {
      const server = new NodemonServer({}, '/test/context');
      expect(server.debugMode).toBe(false);
    });
  });

  describe('start', () => {
    it('should configure nodemon with correct script path', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      const startPromise = server.start();
      
      // Trigger start event
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      
      await startPromise;

      expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({
          script: expect.stringContaining('src/index.js')
        })
      );
    });

    it('should watch src and config directories', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: expect.arrayContaining([
            expect.stringContaining('src'),
            expect.stringContaining('config')
          ])
        })
      );
    });

    it('should watch js and json extensions', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({
          ext: 'js,json'
        })
      );
    });

    it('should ignore test files', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({
          ignore: expect.arrayContaining([
            '*.test.js',
            '*.spec.js',
            'node_modules/*'
          ])
        })
      );
    });

    it('should set environment variables', async () => {
      const server = new NodemonServer({ mode: 'development', port: 4000 }, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({
            NODE_ENV: 'development',
            PORT: 4000,
            CORS_ENABLED: 'true',
            CORS_ORIGIN: '*',
            BODY_PARSER_LIMIT: '50mb',
            REQUEST_TIMEOUT: '60000'
          })
        })
      );
    });

    it('should use node --inspect in debug mode', async () => {
      const server = new NodemonServer({ debug: true }, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({
          exec: 'node --inspect'
        })
      );
    });

    it('should use regular node when not in debug mode', async () => {
      const server = new NodemonServer({ debug: false }, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(nodemon).toHaveBeenCalledWith(
        expect.objectContaining({
          exec: 'node'
        })
      );
    });

    it('should log success message on start', async () => {
      const server = new NodemonServer({ port: 3000 }, '/test/context');
      const showHelpSpy = jest.spyOn(server, 'showHelp').mockImplementation();
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('API server started')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3000')
      );
      expect(showHelpSpy).toHaveBeenCalled();
    });

    it('should log debug mode message when enabled', async () => {
      const server = new NodemonServer({ debug: true }, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug mode enabled')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('chrome://inspect')
      );
    });

    it('should only log once on multiple start events', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      
      startCallback(); // First call
      startCallback(); // Second call
      
      await startPromise;

      const startMessages = consoleLogSpy.mock.calls.filter(
        call => call[0].includes('API server started')
      );
      expect(startMessages).toHaveLength(1);
    });

    describe('Event Handlers', () => {
      it('should handle restart event', async () => {
        const server = new NodemonServer({}, '/test/context');
        
        const startPromise = server.start();
        const startCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'start'
        )[1];
        startCallback();
        await startPromise;

        const restartCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'restart'
        )[1];
        restartCallback(['file1.js', 'file2.js']);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('API Server restarting')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Changes detected in')
        );
      });

      it('should handle crash event', async () => {
        const server = new NodemonServer({}, '/test/context');
        
        const startPromise = server.start();
        const startCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'start'
        )[1];
        startCallback();
        await startPromise;

        const crashCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'crash'
        )[1];
        crashCallback();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('API Server crashed')
        );
      });

      it('should handle quit event', async () => {
        const server = new NodemonServer({}, '/test/context');
        
        const startPromise = server.start();
        const startCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'start'
        )[1];
        startCallback();
        await startPromise;

        const quitCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'quit'
        )[1];
        quitCallback();

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('API Server stopped')
        );
      });

      it('should filter stderr logs', async () => {
        const server = new NodemonServer({}, '/test/context');
        
        const startPromise = server.start();
        const startCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'start'
        )[1];
        startCallback();
        await startPromise;

        const stderrCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'stderr'
        )[1];
        
        stderrCallback(Buffer.from('Listening on port 3000'));
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        
        stderrCallback(Buffer.from('Real error message'));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Real error message')
        );
      });

      it('should log HTTP requests from stdout', async () => {
        const server = new NodemonServer({}, '/test/context');
        
        const startPromise = server.start();
        const startCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'start'
        )[1];
        startCallback();
        await startPromise;

        const stdoutCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'stdout'
        )[1];
        
        stdoutCallback(Buffer.from('HTTP GET /api/test'));
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('HTTP GET /api/test')
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle uncaughtException and restart', async () => {
        jest.useFakeTimers();
        const server = new NodemonServer({}, '/test/context');
        const restartSpy = jest.spyOn(server, 'restart').mockResolvedValue();
        server.nodemon = mockNodemon; // Set nodemon so restart has context
        const debug = (...args) => console.log('[DEBUG uncaughtException]', ...args);

        const startPromise = server.start();
        debug('startPromise created');
        const startCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'start'
        )[1];
        debug('startCallback found');
        startCallback();
        await startPromise;
        debug('startPromise awaited');

        const uncaughtCallback = processListeners['uncaughtException'][0];
        debug('uncaughtCallback found');
        const error = new Error('Test error');
        uncaughtCallback(error);
        debug('uncaughtCallback called');
        jest.runAllTimers();
        debug('timers run');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Uncaught Exception')
        );
        expect(restartSpy).toHaveBeenCalled();
        jest.useRealTimers();
      }, 10000);

      it('should handle unhandledRejection and restart', async () => {
        jest.useFakeTimers();
        const server = new NodemonServer({}, '/test/context');
        const restartSpy = jest.spyOn(server, 'restart').mockResolvedValue();
        server.nodemon = mockNodemon; // Set nodemon so restart has context
        const debug = (...args) => console.log('[DEBUG unhandledRejection]', ...args);

        const startPromise = server.start();
        debug('startPromise created');
        const startCallback = mockNodemon.on.mock.calls.find(
          call => call[0] === 'start'
        )[1];
        debug('startCallback found');
        startCallback();
        await startPromise;
        debug('startPromise awaited');

        const rejectionCallback = processListeners['unhandledRejection'][0];
        debug('rejectionCallback found');
        const reason = 'Test rejection';
        const promise = Promise.reject(reason).catch(() => {}); // Prevent actual unhandled rejection
        rejectionCallback(reason, promise);
        debug('rejectionCallback called');
        jest.runAllTimers();
        debug('timers run');

        // Patch: check for multiple calls with expected substrings
        const errorCalls = consoleErrorSpy.mock.calls.map(call => call[0]);
        expect(errorCalls.some(msg => typeof msg === 'string' && msg.includes('Unhandled Rejection'))).toBe(true);
        expect(errorCalls.some(msg => typeof msg === 'string' && msg.includes('Reason'))).toBe(true);
        expect(restartSpy).toHaveBeenCalled();
        jest.useRealTimers();
      }, 10000);
    });
  });

  describe('stop', () => {
    it('should emit quit event', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;

      mockNodemon.once.mockImplementation((event, callback) => {
        if (event === 'quit') {
          callback();
        }
      });

      await server.stop();

      expect(mockNodemon.emit).toHaveBeenCalledWith('quit');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Server stopped')
      );
    });

    it('should do nothing if nodemon not running', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      await server.stop();

      expect(mockNodemon.emit).not.toHaveBeenCalled();
    });
  });

  describe('restart', () => {
    it('should stop and start server', async () => {
      const server = new NodemonServer({}, '/test/context');
      server.nodemon = mockNodemon; // Set nodemon to trigger restart logic
      const stopSpy = jest.spyOn(server, 'stop').mockResolvedValue();
      const startSpy = jest.spyOn(server, 'start').mockResolvedValue();

      await server.restart();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Restarting API server')
      );
      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });

    it('should do nothing if nodemon not running', async () => {
      const server = new NodemonServer({}, '/test/context');
      const stopSpy = jest.spyOn(server, 'stop');
      const startSpy = jest.spyOn(server, 'start');

      await server.restart();

      expect(stopSpy).not.toHaveBeenCalled();
      expect(startSpy).not.toHaveBeenCalled();
    });
  });

  describe('showHelp', () => {
    it('should display NodemonServer-specific help', () => {
      const server = new NodemonServer({}, '/test/context');
      
      server.showHelp();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Press d to toggle debug mode')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Press l to toggle detailed logging')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Press c to clear console')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Press t to test all endpoints')
      );
    });
  });

  describe('testEndpoints', () => {
    it('should test all HTTP methods', async () => {
      const server = new NodemonServer({ port: 3000 }, '/test/context');
      
      await server.testEndpoints();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Testing endpoints')
      );
    });
  });

  describe('Enhanced Keyboard Controls', () => {
    it('should handle d key (toggle debug)', async () => {
      jest.useFakeTimers();
      const server = new NodemonServer({ debug: false }, '/test/context');
      const restartSpy = jest.spyOn(server, 'restart').mockResolvedValue();
      const debug = (...args) => console.log('[DEBUG d key]', ...args);

      const startPromise = server.start();
      debug('startPromise created');
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      debug('startCallback found');
      startCallback();
      await startPromise;
      debug('startPromise awaited');

      const dataCallback = stdinListeners['data'][0];
      debug('dataCallback found');
      dataCallback(Buffer.from('d'));
      debug('dataCallback called');
      jest.runAllTimers();
      debug('timers run');

      expect(server.debugMode).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug mode enabled')
      );
      expect(restartSpy).toHaveBeenCalled();
      jest.useRealTimers();
    }, 10000);

    it('should handle c key (clear console)', async () => {
      jest.useFakeTimers();
      const server = new NodemonServer({}, '/test/context');
      const consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation();
      const showHelpSpy = jest.spyOn(server, 'showHelp').mockImplementation();
      const debug = (...args) => console.log('[DEBUG c key]', ...args);

      const startPromise = server.start();
      debug('startPromise created');
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      debug('startCallback found');
      startCallback();
      await startPromise;
      debug('startPromise awaited');

      const dataCallback = stdinListeners['data'][0];
      debug('dataCallback found');
      dataCallback(Buffer.from('c'));
      debug('dataCallback called');
      jest.runAllTimers();
      debug('timers run');

      expect(consoleClearSpy).toHaveBeenCalled();
      expect(showHelpSpy).toHaveBeenCalled();

      consoleClearSpy.mockRestore();
      jest.useRealTimers();
    }, 10000);

    it('should handle t key (test endpoints)', async () => {
      jest.useFakeTimers();
      const server = new NodemonServer({}, '/test/context');
      const testEndpointsSpy = jest.spyOn(server, 'testEndpoints').mockResolvedValue();
      const debug = (...args) => console.log('[DEBUG t key]', ...args);

      const startPromise = server.start();
      debug('startPromise created');
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      debug('startCallback found');
      startCallback();
      await startPromise;
      debug('startPromise awaited');

      const dataCallback = stdinListeners['data'][0];
      debug('dataCallback found');
      dataCallback(Buffer.from('t'));
      debug('dataCallback called');
      jest.runAllTimers();
      debug('timers run');

      expect(testEndpointsSpy).toHaveBeenCalled();
      jest.useRealTimers();
    }, 10000);
  });

  describe('Integration', () => {
    it('should inherit BaseServer functionality', () => {
      const server = new NodemonServer({}, '/test/context');
      expect(server.setupProcessHandling).toBeDefined();
      expect(server.handleShutdown).toBeDefined();
      expect(server.port).toBeDefined();
    });

    it('should support full lifecycle', async () => {
      const server = new NodemonServer({}, '/test/context');
      
      const startPromise = server.start();
      const startCallback = mockNodemon.on.mock.calls.find(
        call => call[0] === 'start'
      )[1];
      startCallback();
      await startPromise;
      
      expect(server.nodemon).not.toBeNull();
      
      mockNodemon.once.mockImplementation((event, callback) => {
        if (event === 'quit') callback();
      });
      
      await server.stop();
      
      // nodemon stays assigned, just emits quit
      expect(mockNodemon.emit).toHaveBeenCalledWith('quit');
    });
  });
});
