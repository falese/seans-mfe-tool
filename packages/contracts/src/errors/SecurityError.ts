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
