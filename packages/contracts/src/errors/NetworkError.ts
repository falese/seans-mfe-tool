export class NetworkError extends Error {
  readonly type = 'network';
  readonly retryable = true;
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NetworkError);
    }
  }
}
