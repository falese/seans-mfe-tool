/**
 * Error Classifier Tests
 * Following REQ-LIFECYCLE-005: Error Classification
 */

import { classifyError, formatErrorResponse, ErrorHandlingConfig } from '../error-classifier';
import { NetworkError, ValidationError, SecurityError } from '../errors';

describe('classifyError', () => {
  const errorConfig: ErrorHandlingConfig = {
    types: [
      {
        type: 'network',
        pattern: 'ECONNREFUSED|ETIMEDOUT|ENOTFOUND',
        retryable: true
      },
      {
        type: 'validation',
        pattern: 'Invalid|ValidationError',
        retryable: false,
        userFacing: true,
        message: 'Invalid input'
      }
    ]
  };

  describe('typed errors', () => {
    it('should classify NetworkError as retryable', () => {
      const error = new NetworkError('Connection refused', 503);
      const classification = classifyError(error, errorConfig);

      expect(classification).toEqual({
        type: 'network',
        retryable: true,
        userFacing: false,
        auditLog: false,
        userMessage: undefined
      });
    });

    it('should classify ValidationError as non-retryable', () => {
      const error = new ValidationError('Invalid email', 'email', 'format');
      const classification = classifyError(error, errorConfig);

      expect(classification).toEqual({
        type: 'validation',
        retryable: false,
        userFacing: true,
        auditLog: false,
        userMessage: undefined
      });
    });

    it('should classify SecurityError with audit flag', () => {
      const error = new SecurityError('Unauthorized access', { userId: '123' });
      const classification = classifyError(error, errorConfig);

      expect(classification).toEqual({
        type: 'security',
        retryable: false,
        userFacing: false,
        auditLog: true,
        userMessage: 'Access denied'
      });
    });
  });

  describe('pattern matching', () => {
    it('should match network error patterns', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const classification = classifyError(error, errorConfig);

      expect(classification.type).toBe('network');
      expect(classification.retryable).toBe(true);
    });

    it('should match validation error patterns', () => {
      const error = new Error('Invalid email format');
      const classification = classifyError(error, errorConfig);

      expect(classification.type).toBe('validation');
      expect(classification.retryable).toBe(false);
      expect(classification.userFacing).toBe(true);
    });

    it('should be case-insensitive', () => {
      const error = new Error('etimedout - request timeout');
      const classification = classifyError(error, errorConfig);

      expect(classification.type).toBe('network');
    });
  });

  describe('unknown errors', () => {
    it('should classify unknown errors as non-retryable', () => {
      const error = new Error('Something went wrong');
      const classification = classifyError(error, errorConfig);

      expect(classification).toEqual({
        type: 'unknown',
        retryable: false,
        userFacing: false
      });
    });
  });
});

describe('formatErrorResponse', () => {
  it('should format user-facing validation error', () => {
    const error = new ValidationError('Invalid email', 'email', 'format');
    const classification = { type: 'validation' as const, retryable: false, userFacing: true };
    
    const response = formatErrorResponse(error, classification);

    expect(response).toEqual({
      error: {
        type: 'validation',
        message: 'Invalid email',
        field: 'email',
        code: 'ERR_VALIDATION'
      }
    });
  });

  it('should sanitize security errors', () => {
    const error = new SecurityError('JWT token expired', { token: 'secret123' });
    const classification = { type: 'security' as const, retryable: false, auditLog: true };
    
    const response = formatErrorResponse(error, classification);

    expect(response).toEqual({
      error: {
        type: 'security',
        message: 'Access denied',
        code: 'ERR_ACCESS_DENIED'
      }
    });
    // Sensitive details NOT exposed
    expect(response.error.message).not.toContain('secret');
  });

  it('should format internal server error for unknown types', () => {
    const error = new Error('Database connection failed');
    const classification = { type: 'unknown' as const, retryable: false };
    
    const response = formatErrorResponse(error, classification);

    expect(response).toEqual({
      error: {
        type: 'unknown',
        message: 'Internal server error',
        code: 'ERR_INTERNAL'
      }
    });
  });
});
