/**
 * Retry Wrapper Tests
 * Following REQ-LIFECYCLE-005: Smart Retry with Exponential Backoff
 */

import { withRetry, RetryConfig } from '../retry-wrapper';
import { ErrorHandlingConfig } from '../error-classifier';
import { NetworkError, ValidationError } from '../errors';
import { ContextFactory } from '../context';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const retryConfig: RetryConfig = {
    maxRetries: 3,
    backoff: 'exponential',
    baseDelay: 100,
    maxDelay: 1000,
    jitter: false
  };

  const errorConfig: ErrorHandlingConfig = {
    types: [
      {
        type: 'network',
        retryable: true
      },
      {
        type: 'validation',
        retryable: false
      }
    ]
  };

  describe('successful execution', () => {
    it('should succeed on first attempt', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      const handler = jest.fn().mockResolvedValue('success');
      
      const promise = withRetry(handler, retryConfig, errorConfig, context, 'testHandler');
      const result = await promise;

      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(context.retry).toBeUndefined();
    });
  });

  describe('retry on network errors', () => {
    it('should retry network errors with exponential backoff', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      const handler = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Connection refused', 503))
        .mockRejectedValueOnce(new NetworkError('Connection refused', 503))
        .mockResolvedValue('success');

      const promise = withRetry(handler, retryConfig, errorConfig, context, 'testHandler');
      
      // Flush all pending promises and timers
      await jest.runAllTimersAsync();
      
      const result = await promise;

      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should track retry state in context', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      
      let capturedRetryState: any;
      const handler = jest.fn().mockImplementation(async () => {
        capturedRetryState = { ...context.retry };
        
        if ((context.retry?.attempt ?? 0) < 2) {
          throw new NetworkError('Timeout', 503);
        }
        return 'success';
      });

      const promise = withRetry(handler, retryConfig, errorConfig, context, 'testHandler');
      
      // Flush all timers
      await jest.runAllTimersAsync();
      await promise;

      expect(handler).toHaveBeenCalledTimes(3);
      expect(capturedRetryState).toMatchObject({
        attempt: 2,
        maxRetries: 3,
        isRetry: true
      });
    });
  });

  describe('no retry on validation errors', () => {
    it('should not retry validation errors', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      const handler = jest.fn().mockRejectedValue(
        new ValidationError('Invalid input', 'email', 'format')
      );

      const promise = withRetry(handler, retryConfig, errorConfig, context, 'testHandler');

      await expect(promise).rejects.toThrow(ValidationError);
      expect(handler).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('backoff strategies', () => {
    it('should use exponential backoff correctly', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      
      // Track delays through telemetry
      const delays: number[] = [];
      context.emit = jest.fn().mockImplementation((event: any) => {
        if (event.name === 'lifecycle.error.backoff') {
          delays.push(event.metadata.delay);
        }
        return Promise.resolve();
      });
      
      const handler = jest.fn().mockRejectedValue(new NetworkError('Timeout', 503));
      const promise = withRetry(handler, retryConfig, errorConfig, context, 'testHandler');

      // Don't await the promise, just run timers
      jest.runAllTimersAsync().catch(() => {});

      await expect(promise).rejects.toThrow(NetworkError);
      expect(delays).toEqual([100, 200, 400]);
    });
  });

  describe('onRetry hook', () => {
    it('should call onRetry hook before each retry', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      const onRetryHandler = jest.fn().mockResolvedValue(undefined);
      context.handlers = { adjustContext: onRetryHandler };
      
      const handler = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Timeout', 503))
        .mockResolvedValue('success');

      const configWithOnRetry = { ...retryConfig, onRetry: 'adjustContext' };
      const promise = withRetry(handler, configWithOnRetry, errorConfig, context, 'testHandler');

      await jest.runAllTimersAsync();
      await promise;

      expect(onRetryHandler).toHaveBeenCalledTimes(1);
      expect(onRetryHandler).toHaveBeenCalledWith(context);
    });
  });

  describe('fallback handler', () => {
    it('should invoke fallback after retries exhausted', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      const fallbackHandler = jest.fn().mockResolvedValue('fallback-result');
      context.handlers = { useCached: fallbackHandler };
      
      const handler = jest.fn().mockRejectedValue(new NetworkError('Timeout', 503));

      const configWithFallback = { ...retryConfig, fallbackHandler: 'useCached' };
      const promise = withRetry(handler, configWithFallback, errorConfig, context, 'testHandler');

      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('fallback-result');
      expect(fallbackHandler).toHaveBeenCalledWith(context);
      expect(context.fallback).toBeUndefined(); // Cleared after fallback
    });

    it('should mark context with fallback state', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      
      let capturedFallbackState: any;
      const fallbackHandler = jest.fn().mockImplementation(async (ctx) => {
        capturedFallbackState = { ...ctx.fallback };
        return 'fallback-result';
      });
      context.handlers = { useCached: fallbackHandler };
      
      const handler = jest.fn().mockRejectedValue(new NetworkError('Timeout', 503));

      const configWithFallback = { ...retryConfig, fallbackHandler: 'useCached' };
      const promise = withRetry(handler, configWithFallback, errorConfig, context, 'testHandler');

      await jest.runAllTimersAsync();
      await promise;

      expect(capturedFallbackState).toMatchObject({
        active: true,
        reason: 'network',
        retriesExhausted: 3
      });
    });
  });

  describe('telemetry', () => {
    it('should emit classification telemetry', async () => {
      const context = ContextFactory.create({ capability: 'load' });
      context.emit = jest.fn();
      const handler = jest.fn().mockRejectedValue(new NetworkError('Timeout', 503));

      const promise = withRetry(handler, retryConfig, errorConfig, context, 'testHandler');

      jest.runAllTimersAsync().catch(() => {});
      await expect(promise).rejects.toThrow(NetworkError);

      expect(context.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'lifecycle.error.classified',
          metadata: expect.objectContaining({
            errorType: 'network',
            retryable: true,
            attempt: 0
          })
        })
      );
    });
  });
});
