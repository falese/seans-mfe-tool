import type { Context } from '../context';

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

/**
 * `error` is optional because this handler is dispatched by name
 * (`platform.handleError`, ADR-076) with only `context` — the engine sets
 * `context.error` before running error-phase hooks, so that is the fallback.
 * An explicit second argument still wins for direct (non-dispatched) calls.
 *
 * Retry is not this handler's job: exponential-backoff retry is a separate,
 * already-implemented mechanism (`retry-wrapper.ts`, ADR-030) that wraps
 * capability execution rather than running as a lifecycle hook.
 */
export async function handleError(context: Context, error?: Error): Promise<void> {
  const resolvedError = error ?? context.error ?? new Error('Unknown error');
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      name: 'error.handling.handle',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'error',
      metadata: { source: 'platform.handleError', error: resolvedError.message, severity: 'error' },
      timestamp: new Date(),
    });
  }
}
