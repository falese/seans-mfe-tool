/**
 * NetworkError
 * Thrown for network/connectivity issues (retryable).
 * Following REQ-LIFECYCLE-005: Error Classification
 * Following ADR-065: Error Classification with Hybrid Detection
 */

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
