import { Context } from '../base-mfe';

export async function handleError(context: Context, error: Error): Promise<void> {
  // Emit error telemetry
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      eventType: 'error',
      eventData: { source: 'platform.handleError', error: error.message },
      severity: 'error',
    });
  }
  // Example: retry logic could be added here
}
