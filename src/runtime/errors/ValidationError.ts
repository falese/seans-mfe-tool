/**
 * ValidationError
 * Thrown for user input validation failures (not retryable, user-facing).
 * Following REQ-LIFECYCLE-005: Error Classification
 * Following ADR-065: Error Classification with Hybrid Detection
 */

export class ValidationError extends Error {
  readonly type = 'validation';
  readonly retryable = false;
  readonly userFacing = true;
  field: string;
  constraint: string;

  constructor(message: string, field: string, constraint: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.constraint = constraint;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}
