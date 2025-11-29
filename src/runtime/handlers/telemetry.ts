
import { Context } from '../base-mfe';
export async function logTelemetry(context: Context, event?: object): Promise<void> {
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      eventType: 'telemetry',
      eventData: { source: 'platform.logTelemetry', ...(event || {}) },
      severity: 'info',
    });
  }
}
