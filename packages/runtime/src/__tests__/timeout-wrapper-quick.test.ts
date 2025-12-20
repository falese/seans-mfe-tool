/**
 * Quick Timeout Wrapper Tests
 * Uses jest fake timers for fast execution
 */

import { withTimeout } from '../timeout-wrapper';
import { TimeoutError } from '../errors/TimeoutError';
import { ContextFactory } from '../context';

describe('withTimeout - quick tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve if handler completes before timeout', async () => {
    const context = ContextFactory.create({ capability: 'load' });
    context.emit = jest.fn();
    const handler = jest.fn().mockResolvedValue('success');
    
    const promise = withTimeout(handler, {
      timeoutMs: 1000,
      onTimeout: 'error',
      hookName: 'testHook'
    }, context);

    const result = await promise;

    expect(result).toBe('success');
    expect(handler).toHaveBeenCalled();
    expect(context.timeouts).toBeUndefined();
  });

  it('should throw TimeoutError if handler exceeds timeout', async () => {
    const context = ContextFactory.create({ capability: 'load' });
    context.emit = jest.fn();
    const handler = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 200))
    );

    const promise = withTimeout(handler, {
      timeoutMs: 50,
      onTimeout: 'error',
      hookName: 'slowHandler'
    }, context);

    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(50);

    await expect(promise).rejects.toThrow(TimeoutError);

    expect(context.timeouts?.slowHandler).toEqual({
      occurred: true,
      elapsed: 50,
      onTimeout: 'error'
    });
  });

  it('should log warning and continue if onTimeout is warn', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    const context = ContextFactory.create({ capability: 'load' });
    context.emit = jest.fn();
    const handler = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 200))
    );

    const promise = withTimeout(handler, {
      timeoutMs: 50,
      onTimeout: 'warn',
      hookName: 'slowHandler'
    }, context);

    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(50);

    const result = await promise;

    expect(result).toBeUndefined();
    expect(consoleWarn).toHaveBeenCalledWith(
      "Handler 'slowHandler' timed out (continued)"
    );
    expect(context.timeouts?.slowHandler?.occurred).toBe(true);
    
    consoleWarn.mockRestore();
  });

  it('should silently continue if onTimeout is skip', async () => {
    const context = ContextFactory.create({ capability: 'load' });
    context.emit = jest.fn();
    const handler = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 200))
    );

    const promise = withTimeout(handler, {
      timeoutMs: 50,
      onTimeout: 'skip',
      hookName: 'slowHandler'
    }, context);

    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(50);

    const result = await promise;

    expect(result).toBeUndefined();
    expect(context.timeouts?.slowHandler).toBeDefined();
  });

  it('should emit telemetry event on timeout', async () => {
    const context = ContextFactory.create({ capability: 'load' });
    context.emit = jest.fn();
    const handler = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 200))
    );

    const promise = withTimeout(handler, {
      timeoutMs: 50,
      onTimeout: 'error',
      hookName: 'slowHandler'
    }, context);

    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(50);

    try {
      await promise;
    } catch (error) {
      // Expected
    }

    expect(context.emit).toHaveBeenCalledWith({
      name: 'lifecycle.timeout',
      capability: 'load',
      phase: 'before',
      status: 'error',
      metadata: {
        hook: 'slowHandler',
        timeout: 50,
        elapsed: 50,
        onTimeout: 'error',
        severity: 'error'
      },
      timestamp: expect.any(Date)
    });
  });
});
