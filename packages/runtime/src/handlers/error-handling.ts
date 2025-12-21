import { Context } from '../base-mfe';

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
