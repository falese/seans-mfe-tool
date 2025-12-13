/**
 * Error Classifier
 * Classifies errors by type and determines retry strategy.
 * Following REQ-LIFECYCLE-005: Error Classification
 * Following ADR-065: Error Classification with Hybrid Detection
 */

export interface ErrorClassification {
  type: 'network' | 'validation' | 'business' | 'security' | 'system' | 'timeout' | 'unknown';
  retryable: boolean;
  userFacing?: boolean;
  auditLog?: boolean;
  userMessage?: string;
}

export interface ErrorHandlingConfig {
  types: Array<{
    type: string;
    pattern?: string;
    retryable: boolean;
    maxRetries?: number;
    backoff?: 'exponential' | 'linear' | 'constant';
    baseDelay?: number;
    maxDelay?: number;
    jitter?: boolean;
    onRetry?: string;
    fallbackHandler?: string;
    userFacing?: boolean;
    message?: string;
  }>;
}

/**
 * Classifies an error using hybrid detection:
 * 1. Check for typed error (has 'type' property)
 * 2. Pattern match error message against config
 * 3. Default to 'unknown' (not retryable)
 */
export function classifyError(error: Error, config: ErrorHandlingConfig): ErrorClassification {
  // 1. Check if error has 'type' property (typed error - preferred)
  if ('type' in error && typeof (error as any).type === 'string') {
    const typedError = error as any;
    return {
      type: typedError.type,
      retryable: typedError.retryable ?? false,
      userFacing: typedError.userFacing ?? false,
      auditLog: typedError.auditLog ?? false,
      userMessage: typedError.userMessage
    };
  }

  // 2. Pattern matching (fallback for third-party errors)
  for (const typeConfig of config.types) {
    if (typeConfig.pattern) {
      const regex = new RegExp(typeConfig.pattern, 'i'); // Case-insensitive
      if (regex.test(error.message)) {
        return {
          type: typeConfig.type as any,
          retryable: typeConfig.retryable,
          userFacing: typeConfig.userFacing,
          userMessage: typeConfig.message
        };
      }
    }
  }

  // 3. Generic error (not retryable, log stack)
  return {
    type: 'unknown',
    retryable: false,
    userFacing: false
  };
}

/**
 * Formats error response for user consumption.
 * Sanitizes sensitive information.
 */
export function formatErrorResponse(error: Error, classification: ErrorClassification) {
  if (classification.userFacing) {
    // Sanitized error for user
    return {
      error: {
        type: classification.type,
        message: classification.userMessage || error.message,
        field: (error as any).field,
        code: `ERR_${classification.type.toUpperCase()}`
      }
    };
  } else if (classification.type === 'security') {
    // Generic message for security errors (never expose details)
    return {
      error: {
        type: 'security',
        message: 'Access denied',
        code: 'ERR_ACCESS_DENIED'
      }
    };
  } else {
    // Internal error (developer-facing in logs only)
    return {
      error: {
        type: classification.type,
        message: 'Internal server error',
        code: 'ERR_INTERNAL'
      }
    };
  }
}
