/**
 * Retry Wrapper
 * Implements smart retry with exponential backoff, onRetry hooks, and fallback handlers.
 * Following REQ-LIFECYCLE-005: Error Classification
 * Following ADR-065: Error Classification with Hybrid Detection
 */

import { Context } from './context';
import { classifyError, ErrorHandlingConfig, ErrorClassification } from './error-classifier';

export interface RetryConfig {
  maxRetries: number;
  backoff: 'exponential' | 'linear' | 'constant';
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  onRetry?: string;
  fallbackHandler?: string;
}

/**
 * Wraps a function with retry logic based on error classification.
 * 
 * @param fn - The function to execute with retry protection
 * @param config - Retry configuration
 * @param errorConfig - Error classification config
 * @param context - Lifecycle context
 * @param hookName - Name of the hook for telemetry
 * @returns Result of fn() or fallback handler
 * @throws Error if all retries exhausted and no fallback
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  errorConfig: ErrorHandlingConfig,
  context: Context,
  hookName: string
): Promise<T> {
  let lastError: Error;
  const previousErrors: Array<{ message: string; timestamp: string }> = [];

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Mark retry state in context
      context.retry = {
        attempt,
        maxRetries: config.maxRetries,
        isRetry: attempt > 0,
        previousErrors
      };

      // Call onRetry hook if configured (before retry attempt)
      if (attempt > 0 && config.onRetry && context.handlers?.[config.onRetry]) {
        await context.handlers[config.onRetry](context);
      }

      // Emit retry telemetry
      if (attempt > 0 && context.emit) {
        await context.emit({
          eventType: 'lifecycle.error.retry',
          eventData: {
            attempt,
            previousError: lastError?.message,
            handler: hookName
          },
          severity: 'warn'
        });
      }

      // Attempt handler execution
      const result = await fn();
      
      // Success - clear retry state
      delete context.retry;
      return result;
      
    } catch (error) {
      lastError = error as Error;
      previousErrors.push({
        message: (error as Error).message,
        timestamp: new Date().toISOString()
      });

      // Classify error
      const classification = classifyError(error as Error, errorConfig);

      // Emit classification telemetry
      if (context.emit) {
        await context.emit({
          eventType: 'lifecycle.error.classified',
          eventData: {
            errorType: classification.type,
            retryable: classification.retryable,
            attempt,
            maxRetries: config.maxRetries,
            handler: hookName
          },
          severity: 'error'
        });
      }

      // Check if retryable
      if (!classification.retryable || attempt === config.maxRetries) {
        // Attempt fallback handler if configured
        if (attempt === config.maxRetries && config.fallbackHandler) {
          return await invokeFallbackHandler(
            config.fallbackHandler,
            context,
            lastError,
            config.maxRetries,
            classification
          );
        }
        
        delete context.retry;
        throw error;
      }

      // Calculate backoff delay
      const delay = calculateBackoff(config, attempt);

      // Emit backoff telemetry
      if (context.emit) {
        await context.emit({
          eventType: 'lifecycle.error.backoff',
          eventData: {
            attempt,
            delay,
            backoff: config.backoff,
            handler: hookName
          },
          severity: 'info'
        });
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Calculates backoff delay with optional jitter.
 * 
 * Exponential: delay = baseDelay * 2^attempt
 * Linear: delay = baseDelay * (attempt + 1)
 * Constant: delay = baseDelay
 */
function calculateBackoff(config: RetryConfig, attempt: number): number {
  let delay: number;

  if (config.backoff === 'exponential') {
    delay = config.baseDelay * Math.pow(2, attempt);
  } else if (config.backoff === 'linear') {
    delay = config.baseDelay * (attempt + 1);
  } else {
    delay = config.baseDelay; // constant
  }

  // Cap at maxDelay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter (±20% random to prevent thundering herd)
  if (config.jitter) {
    const jitterRange = delay * 0.2;
    delay += Math.random() * jitterRange - jitterRange / 2;
  }

  return Math.round(delay);
}

/**
 * Invokes fallback handler after all retries exhausted.
 * Marks context with fallback state.
 */
async function invokeFallbackHandler<T>(
  fallbackHandlerName: string,
  context: Context,
  originalError: Error,
  retriesExhausted: number,
  classification: ErrorClassification
): Promise<T> {
  // Mark fallback mode in context
  context.fallback = {
    active: true,
    reason: classification.type,
    originalError,
    retriesExhausted
  };

  // Emit fallback telemetry
  if (context.emit) {
    await context.emit({
      eventType: 'lifecycle.error.fallback',
      eventData: {
        retriesExhausted,
        fallbackHandler: fallbackHandlerName,
        originalError: originalError.message
      },
      severity: 'warn'
    });
  }

  // Invoke fallback handler
  const handler = context.handlers?.[fallbackHandlerName];
  if (!handler) {
    throw new Error(`Fallback handler '${fallbackHandlerName}' not found`);
  }

  const result = await handler(context);
  
  // Clear fallback state
  delete context.fallback;
  
  return result;
}

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
