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
 * The shape a typed error from @falese/smt-contracts (or a duck-typed
 * equivalent) may carry. `type` is the only field classifyError requires;
 * the rest vary by error class (e.g. only ValidationError sets `field`).
 */
interface TypedErrorLike {
  type: string;
  retryable?: boolean;
  userFacing?: boolean;
  auditLog?: boolean;
  userMessage?: string;
  field?: string;
}

function asTypedError(error: Error): (Error & TypedErrorLike) | undefined {
  const candidate = error as unknown as Record<string, unknown>;
  return typeof candidate.type === 'string' ? (error as Error & TypedErrorLike) : undefined;
}

/**
 * Classifies an error using hybrid detection:
 * 1. Check for typed error (has 'type' property)
 * 2. Pattern match error message against config
 * 3. Default to 'unknown' (not retryable)
 *
 * ADR-030: Error Classification with Hybrid Detection
 */
export function classifyError(error: Error, config: ErrorHandlingConfig): ErrorClassification {
  const typedError = asTypedError(error);
  if (typedError) {
    return {
      type: typedError.type as ErrorClassification['type'],
      retryable: typedError.retryable ?? false,
      userFacing: typedError.userFacing ?? false,
      auditLog: typedError.auditLog ?? false,
      userMessage: typedError.userMessage,
    };
  }

  for (const typeConfig of config.types) {
    if (typeConfig.pattern) {
      const regex = new RegExp(typeConfig.pattern, 'i');
      if (regex.test(error.message)) {
        return {
          type: typeConfig.type as ErrorClassification['type'],
          retryable: typeConfig.retryable,
          userFacing: typeConfig.userFacing,
          userMessage: typeConfig.message,
        };
      }
    }
  }

  return { type: 'unknown', retryable: false, userFacing: false };
}

export function formatErrorResponse(error: Error, classification: ErrorClassification) {
  if (classification.userFacing) {
    return {
      error: {
        type: classification.type,
        message: classification.userMessage || error.message,
        field: asTypedError(error)?.field,
        code: `ERR_${classification.type.toUpperCase()}`,
      },
    };
  } else if (classification.type === 'security') {
    return { error: { type: 'security', message: 'Access denied', code: 'ERR_ACCESS_DENIED' } };
  } else {
    return { error: { type: classification.type, message: 'Internal server error', code: 'ERR_INTERNAL' } };
  }
}
