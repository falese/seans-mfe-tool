
import { Context } from '../base-mfe';
export async function logTelemetry(context: Context, event?: object): Promise<void> {
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      name: 'telemetry.log',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'success',
      metadata: { source: 'platform.logTelemetry', ...(event || {}), severity: 'info' },
      timestamp: new Date(),
    });
  }
}
