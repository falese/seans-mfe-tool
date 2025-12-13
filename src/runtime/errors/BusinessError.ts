/**
 * BusinessError
 * Thrown for business logic violations (not retryable).
 * Following REQ-LIFECYCLE-005: Error Classification
 * Following ADR-065: Error Classification with Hybrid Detection
 */

export class BusinessError extends Error {
  readonly type = 'business';
  readonly retryable = false;
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details || {};
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BusinessError);
    }
  }
}
