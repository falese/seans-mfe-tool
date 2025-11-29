import { logTelemetry } from '../telemetry';

describe('platform.logTelemetry', () => {
  it('should emit telemetry event with info severity', async () => {
    const emitMock = jest.fn();
    const context = {
      emit: emitMock,
    } as any;
    const event = { foo: 'bar' };
    await logTelemetry(context, event);
    expect(emitMock).toHaveBeenCalledWith({
      eventType: 'telemetry',
      eventData: { source: 'platform.logTelemetry', foo: 'bar' },
      severity: 'info',
    });
  });

  it('should emit telemetry event with default event if none provided', async () => {
    const emitMock = jest.fn();
    const context = {
      emit: emitMock,
    } as any;
    await logTelemetry(context);
    expect(emitMock).toHaveBeenCalledWith({
      eventType: 'telemetry',
      eventData: { source: 'platform.logTelemetry' },
      severity: 'info',
    });
  });
});
