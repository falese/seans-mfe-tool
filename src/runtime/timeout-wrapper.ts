/**
 * Timeout Wrapper
 * Wraps handler execution with timeout protection using Promise.race and AbortSignal.
 * Following REQ-LIFECYCLE-002: Timeout Protection
 * Following ADR-064: Timeout Protection with AbortSignal
 */

import { TimeoutError } from './errors/TimeoutError';
import { Context } from './context';

export interface TimeoutOptions {
  timeoutMs: number;
  onTimeout: 'error' | 'warn' | 'skip';
  hookName: string;
  signal?: AbortSignal;
}

/**
 * Wraps a function with timeout protection.
 * 
 * @param fn - The function to execute with timeout protection
 * @param options - Timeout configuration
 * @param context - Lifecycle context for tracking and telemetry
 * @returns Result of fn() if completes before timeout
 * @throws TimeoutError if timeout exceeded and onTimeout is 'error'
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions,
  context: Context
): Promise<T> {
  const abortController = new AbortController();
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new TimeoutError(
        `Handler '${options.hookName}' timed out after ${options.timeoutMs}ms`,
        options.timeoutMs,
        options.timeoutMs
      ));
    }, options.timeoutMs);
  });

  try {
    const result = await Promise.race([
      fn(),
      timeoutPromise
    ]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    
    if (error instanceof TimeoutError) {
      // Mark context with timeout occurrence
      context.timeouts = context.timeouts || {};
      context.timeouts[options.hookName] = {
        occurred: true,
        elapsed: options.timeoutMs,
        onTimeout: options.onTimeout
      };

      // Emit telemetry event
      if (context.emit) {
        await context.emit({
          name: 'lifecycle.timeout',
          capability: context.capability || 'unknown',
          phase: context.phase || 'before',
          status: 'error',
          metadata: {
            hook: options.hookName,
            timeout: options.timeoutMs,
            elapsed: options.timeoutMs,
            onTimeout: options.onTimeout,
            severity: options.onTimeout === 'error' ? 'error' : 'warn'
          },
          timestamp: new Date()
        });
      }

      // Handle based on onTimeout strategy
      if (options.onTimeout === 'error') {
        throw error;  // Trigger error phase
      } else if (options.onTimeout === 'warn') {
        console.warn(`Handler '${options.hookName}' timed out (continued)`);
        return undefined as T; // Allow continuation
      }
      // onTimeout === 'skip': silent continue
      return undefined as T;
    }
    
    // Re-throw non-timeout errors
    throw error;
  }
}
