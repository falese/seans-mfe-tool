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
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}
