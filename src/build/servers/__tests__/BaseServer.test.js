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

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

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
      new TestServer({}, '/test/context');
      expect(processStdinMock.setRawMode).toHaveBeenCalledWith(true);
    });

    it('should register stdin data listener', () => {
      new TestServer({}, '/test/context');
      expect(processStdinMock.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should register signal handlers', () => {
      const onSpy = jest.spyOn(process, 'on');
      new TestServer({}, '/test/context');
      
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
      
      onSpy.mockRestore();
    });

    it('should register error handlers', () => {
      const onSpy = jest.spyOn(process, 'on');
      new TestServer({}, '/test/context');
      
      expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      
      onSpy.mockRestore();
    });

    describe('Keyboard Controls', () => {
      it('should handle Ctrl+C (0x03)', async () => {
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        dataCallback(Buffer.from([0x03]));
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGINT');
      });

      it('should handle q key', async () => {
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        dataCallback(Buffer.from('q'));
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGINT');
      });

      it('should handle r key (restart)', async () => {
        const server = new TestServer({}, '/test/context');
        const restartSpy = jest.spyOn(server, 'restart');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        await dataCallback(Buffer.from('r'));
        
        expect(restartSpy).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Restarting')
        );
      });

      it('should handle h key (help)', () => {
        const server = new TestServer({}, '/test/context');
        const showHelpSpy = jest.spyOn(server, 'showHelp');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        dataCallback(Buffer.from('h'));
        
        expect(showHelpSpy).toHaveBeenCalled();
      });

      it('should ignore unknown keys', () => {
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const dataCallback = processStdinMock.on.mock.calls.find(
          call => call[0] === 'data'
        )[1];
        
        dataCallback(Buffer.from('x'));
        
        expect(handleShutdownSpy).not.toHaveBeenCalled();
      });
    });

    describe('Signal Handling', () => {
      it('should handle SIGINT signal', async () => {
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const sigintCallback = process.on.mock.calls.find(
          call => call[0] === 'SIGINT'
        )[1];
        
        await sigintCallback();
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGINT');
      });

      it('should handle SIGTERM signal', async () => {
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const sigtermCallback = process.on.mock.calls.find(
          call => call[0] === 'SIGTERM'
        )[1];
        
        await sigtermCallback();
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGTERM');
      });

      it('should handle SIGQUIT signal', async () => {
        const server = new TestServer({}, '/test/context');
        const handleShutdownSpy = jest.spyOn(server, 'handleShutdown');
        
        const sigquitCallback = process.on.mock.calls.find(
          call => call[0] === 'SIGQUIT'
        )[1];
        
        await sigquitCallback();
        
        expect(handleShutdownSpy).toHaveBeenCalledWith('SIGQUIT');
      });
    });

    describe('Error Handling', () => {
      it('should handle uncaughtException', () => {
        new TestServer({}, '/test/context');
        
        const errorCallback = process.on.mock.calls.find(
          call => call[0] === 'uncaughtException'
        )[1];
        
        const error = new Error('Test error');
        errorCallback(error);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Uncaught Exception')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      });

      it('should handle unhandledRejection', () => {
        new TestServer({}, '/test/context');
        
        const rejectionCallback = process.on.mock.calls.find(
          call => call[0] === 'unhandledRejection'
        )[1];
        
        const reason = 'Test rejection';
        const promise = Promise.reject(reason);
        rejectionCallback(reason, promise);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unhandled Rejection')
        );
      });
    });
  });

  describe('handleShutdown', () => {
    it('should stop server gracefully', async () => {
      const server = new TestServer({}, '/test/context');
      const stopSpy = jest.spyOn(server, 'stop');
      
      await server.handleShutdown('SIGTERM');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down')
      );
      expect(stopSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should force exit after timeout', async () => {
      jest.useFakeTimers();
      
      const server = new TestServer({}, '/test/context');
      server.stop = jest.fn(() => new Promise(() => {})); // Never resolves
      
      const shutdownPromise = server.handleShutdown('SIGTERM');
      
      jest.advanceTimersByTime(3000);
      await Promise.resolve(); // Flush promises
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Force exiting')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      jest.useRealTimers();
    });

    it('should restore stdin on shutdown', async () => {
      const server = new TestServer({}, '/test/context');
      
      await server.handleShutdown('SIGINT');
      
      expect(processStdinMock.setRawMode).toHaveBeenCalledWith(false);
      expect(processStdinMock.pause).toHaveBeenCalled();
    });

    it('should handle stop errors gracefully', async () => {
      const server = new TestServer({}, '/test/context');
      server.stop = jest.fn().mockRejectedValue(new Error('Stop failed'));
      
      await server.handleShutdown('SIGTERM');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error during shutdown')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('showHelp', () => {
    it('should display help message', () => {
      const server = new TestServer({}, '/test/context');
      
      server.showHelp();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keyboard shortcuts')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ctrl+C or q')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('r to restart')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('h for help')
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
      
      await expect(server.restart()).rejects.toThrow('Start failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Restart failed')
      );
    });
  });

  describe('Abstract Methods', () => {
    it('should throw error if start not implemented', async () => {
      const server = new BaseServer({}, '/test/context');
      
      await expect(server.start()).rejects.toThrow(
        'start method must be implemented'
      );
    });

    it('should throw error if stop not implemented', async () => {
      const server = new BaseServer({}, '/test/context');
      
      await expect(server.stop()).rejects.toThrow(
        'stop method must be implemented'
      );
    });
  });
});
