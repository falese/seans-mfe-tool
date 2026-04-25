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
