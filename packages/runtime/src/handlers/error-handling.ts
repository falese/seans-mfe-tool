import { Context } from '../base-mfe';

/** Error-handling state this handler owns on the context. */
export interface ErrorHandlingState {
  recoverable?: boolean;
  fallbackApplied?: boolean;
  retryStrategy?: 'exponential' | 'linear' | 'none';
}

/** Typed accessor for the error-handling state this handler owns on a context. */
export function getErrorHandlingState(context: Context): ErrorHandlingState | undefined {
  return context.errorHandling as ErrorHandlingState | undefined;
}

export async function handleError(context: Context, error: Error): Promise<void> {
  // Emit error telemetry
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      name: 'error.handling.handle',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'error',
      metadata: { source: 'platform.handleError', error: error.message, severity: 'error' },
      timestamp: new Date(),
    });
  }
  // Example: retry logic could be added here
}
