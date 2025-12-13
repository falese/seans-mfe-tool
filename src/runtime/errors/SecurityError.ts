/**
 * SecurityError
 * Thrown for authentication/authorization failures (not retryable, audit logged).
 * Following REQ-LIFECYCLE-005: Error Classification
 * Following ADR-065: Error Classification with Hybrid Detection
 */

export class SecurityError extends Error {
  readonly type = 'security';
  readonly retryable = false;
  readonly auditLog = true;
  readonly userMessage = 'Access denied';
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SecurityError';
    this.details = details;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SecurityError);
    }
  }
}
