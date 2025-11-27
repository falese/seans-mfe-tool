const { BaseServer } = require('../BaseServer');
const chalk = require('chalk');

jest.mock('chalk', () => ({
  green: jest.fn((msg) => msg),
  blue: jest.fn((msg) => msg),
  yellow: jest.fn((msg) => msg),
  red: jest.fn((msg) => msg),
  gray: jest.fn((msg) => msg)
}));

// Create concrete implementation for testing abstract class
class TestServer extends BaseServer {
  constructor(options, context) {
    super(options, context);
    this.started = false;
    this.stopped = false;
  }

  async start() {
    this.started = true;
  }

  async stop() {
    this.stopped = true;
  }
}

describe('BaseServer', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;
  let processStdinMock;
  let originalProcessStdin;
  let processOnSpy;
  let processListeners;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    
    // Track process event listeners
    processListeners = {};
    processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (!processListeners[event]) processListeners[event] = [];
      processListeners[event].push(handler);
      return process;
    });

    // Mock process.stdin
    originalProcessStdin = process.stdin;
    processStdinMock = {
      isTTY: true,
      setRawMode: jest.fn(),
      setEncoding: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      resume: jest.fn(),
      pause: jest.fn()
    };
    Object.defineProperty(process, 'stdin', {
      value: processStdinMock,
      writable: true
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
    
    // Restore process.stdin
    Object.defineProperty(process, 'stdin', {
      value: originalProcessStdin,
      writable: true
    });
  });

  describe('constructor', () => {
    it('should initialize with default port', () => {
      const server = new TestServer({}, '/test/context');
      expect(server.port).toBe(3000);
      expect(server.context).toBe('/test/context');
    });

    it('should accept custom port from options', () => {
      const server = new TestServer({ port: 4000 }, '/test/context');
      expect(server.port).toBe(4000);
    });

    it('should default to port 3000 if not specified', () => {
      const server = new TestServer({}, '/test/context');
      expect(server.port).toBe(3000);
    });

    it('should call setupProcessHandling', () => {
      processStdinMock.isTTY = true;
      const server = new TestServer({}, '/test/context');
      expect(processStdinMock.setRawMode).toHaveBeenCalledWith(true);
      expect(processStdinMock.resume).toHaveBeenCalled();
    });
  });

  describe('setupProcessHandling', () => {
    it('should enable raw mode on stdin', () => {
      processStdinMock.isTTY = true;
      new TestServer({}, '/test/context');
      expect(processStdinMock.setRawMode).toHaveBeenCalledWith(true);
    });

    it('should not setup if not TTY', () => {
      processStdinMock.isTTY = false;
      new TestServer({}, '/test/context');
      expect(processStdinMock.setRawMode).not.toHaveBeenCalled();
    });

    it('should register stdin data listener', () => {
      processStdinMock.isTTY = true;
      new TestServer({}, '/test/context');
      expect(processStdinMock.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should register signal handlers', () => {
      processStdinMock.isTTY = true;
      new TestServer({}, '/test/context');
      
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
    });

    it('should register error handlers', () => {
      processStdinMock.isTTY = true;
      new TestServer({}, '/test/context');
      
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    describe('Keyboard Controls', () => {
      it('should handle Ctrl+C (0x03)', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        await dataCallback('\u0003');
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGINT');
      });

      it('should handle q key', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        await dataCallback('q');
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('QUIT');
      });

      it('should handle r key (restart)', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const restartSpy = jest.spyOn(server, 'restart');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        await dataCallback('r');
        
        expect(restartSpy).toHaveBeenCalled();
      });

      it('should handle h key (help)', () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const showHelpSpy = jest.spyOn(server, 'showHelp');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        dataCallback('h');
        
        expect(showHelpSpy).toHaveBeenCalled();
      });

      it('should ignore unknown keys', () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        dataCallback('x');
        
        expect(handleShutdownSpy).not.toHaveBeenCalled();
      });
    });

    describe('Signal Handling', () => {
      it('should handle SIGINT signal', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown').mockResolvedValue();
        
        const sigintHandlers = processListeners['SIGINT'];
        await sigintHandlers[0]();
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGINT');
      });

      it('should handle SIGTERM signal', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown').mockResolvedValue();
        
        const sigtermHandlers = processListeners['SIGTERM'];
        await sigtermHandlers[0]();
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGTERM');
      });

      it('should handle SIGQUIT signal', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown').mockResolvedValue();
        
        const sigquitHandlers = processListeners['SIGQUIT'];
        await sigquitHandlers[0]();
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGQUIT');
      });
    });

    describe('Error Handling', () => {
      it('should handle uncaughtException', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown').mockResolvedValue();
        
        const errorHandlers = processListeners['uncaughtException'];
        const error = new Error('Test error');
        await errorHandlers[0](error);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Uncaught Exception')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
        expect(handleShutdownSpy).toHaveBeenCalledWith('UNCAUGHT_EXCEPTION');
      });

      it('should handle unhandledRejection', async () => {
        processStdinMock.isTTY = true;
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown').mockResolvedValue();
        
        const rejectionHandlers = processListeners['unhandledRejection'];
        const reason = 'Test rejection';
        const promise = Promise.reject(reason).catch(() => {}); // Prevent actual unhandled rejection
        await rejectionHandlers[0](reason, promise);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unhandled Rejection at:'),
          promise
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Reason:'),
          reason
        );
        expect(handleShutdownSpy).toHaveBeenCalledWith('UNHANDLED_REJECTION');
      });
    });
  });

  describe('handleShutdown', () => {
    it('should stop server gracefully', async () => {
      const server = new TestServer({}, '/test/context');
      const stopSpy = jest.spyOn(server, 'stop').mockResolvedValue();
      
      // Don't await - process.exit will be called
      const shutdownPromise = server.handleShutdown('SIGTERM');
      await Promise.resolve(); // Let it start
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('shutting down')
      );
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should force exit after timeout', async () => {
      jest.useFakeTimers();
      
      const server = new TestServer({}, '/test/context');
      server.stop = jest.fn().mockResolvedValue(); // Resolves successfully
      
      server.handleShutdown('SIGTERM');
      await Promise.resolve(); // Let the async function progress
      
      jest.advanceTimersByTime(3000);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Forcing exit')
      );
      
      jest.useRealTimers();
    });

    it('should handle stop errors gracefully', async () => {
      const server = new TestServer({}, '/test/context');
      server.stop = jest.fn().mockRejectedValue(new Error('Stop failed'));
      
      server.handleShutdown('SIGTERM');
      await Promise.resolve(); // Let it process
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error during shutdown')
      );
    });

    it('should not execute multiple times', async () => {
      const server = new TestServer({}, '/test/context');
      const stopSpy = jest.spyOn(server, 'stop').mockResolvedValue();
      
      server.handleShutdown('SIGTERM');
      await Promise.resolve();
      server.handleShutdown('SIGTERM');
      await Promise.resolve();
      
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('showHelp', () => {
    it('should display help message', () => {
      const server = new TestServer({}, '/test/context');
      
      server.showHelp();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available commands')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ctrl+C')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('r to restart')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('h')
      );
    });
  });

  describe('restart', () => {
    it('should stop and start server', async () => {
      const server = new TestServer({}, '/test/context');
      const stopSpy = jest.spyOn(server, 'stop');
      const startSpy = jest.spyOn(server, 'start');
      
      await server.restart();
      
      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Server restarted')
      );
    });

    it('should handle restart errors', async () => {
      const server = new TestServer({}, '/test/context');
      server.start = jest.fn().mockRejectedValue(new Error('Start failed'));
      
      await server.restart();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error restarting server')
      );
    });
  });

  describe('Abstract Methods', () => {
    it('should throw error if start not implemented', async () => {
      const server = new BaseServer({}, '/test/context');
      
      await expect(server.start()).rejects.toThrow(
        'start() must be implemented by server template'
      );
    });

    it('should throw error if stop not implemented', async () => {
      const server = new BaseServer({}, '/test/context');
      
      await expect(server.stop()).rejects.toThrow(
        'stop() must be implemented by server template'
      );
    });
  });
});
