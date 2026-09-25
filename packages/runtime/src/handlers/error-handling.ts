import type { Context } from '../context';

/**
 * `error` is optional because this handler is dispatched by name
 * (`platform.handleError`, ADR-076) with only `context` — the engine sets
 * `context.error` before running error-phase hooks, so that is the fallback.
 * An explicit second argument still wins for direct (non-dispatched) calls.
 *
 * Retry is not this handler's job: exponential-backoff retry (ADR-030) is
 * per-hook policy — `errorHandling` on a lifecycle hook — applied by
 * BaseMFE.invokeGuarded around the handler call, not a hook of its own.
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
