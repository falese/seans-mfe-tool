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
