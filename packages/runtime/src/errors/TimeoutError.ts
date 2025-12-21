/**
 * TimeoutError
 * Thrown when a handler exceeds its configured timeout duration.
 * Following REQ-LIFECYCLE-002: Timeout Protection
 * Following ADR-064: Timeout Protection with AbortSignal
 */

export class TimeoutError extends Error {
  readonly type = 'timeout';
  readonly retryable = true;
  readonly elapsed: number;
  readonly timeout: number;

  constructor(message: string, timeout: number, elapsed: number) {
    super(message);
    this.name = 'TimeoutError';
    this.timeout = timeout;
    this.elapsed = elapsed;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}
