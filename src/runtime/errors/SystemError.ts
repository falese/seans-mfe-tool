/**
 * SystemError
 * Thrown for infrastructure/system failures (retryable).
 * Following REQ-LIFECYCLE-005: Error Classification
 * Following ADR-065: Error Classification with Hybrid Detection
 */

export class SystemError extends Error {
  readonly type = 'system';
  readonly retryable = true;
  cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'SystemError';
    this.cause = cause;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SystemError);
    }
  }
}
