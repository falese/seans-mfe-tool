import { logTelemetry } from '../telemetry';

describe('platform.logTelemetry', () => {
  it('should emit telemetry event with info severity', async () => {
    const emitMock = jest.fn();
    const context = {
      emit: emitMock,
    } as any;
    const event = { foo: 'bar' };
    await logTelemetry(context, event);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'telemetry.log',
      status: 'success',
      metadata: expect.objectContaining({ source: 'platform.logTelemetry', foo: 'bar', severity: 'info' }),
      timestamp: expect.any(Date),
    }));
  });

  it('should emit telemetry event with default event if none provided', async () => {
    const emitMock = jest.fn();
    const context = {
      emit: emitMock,
    } as any;
    await logTelemetry(context);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'telemetry.log',
      status: 'success',
      metadata: expect.objectContaining({ source: 'platform.logTelemetry', severity: 'info' }),
      timestamp: expect.any(Date),
    }));
  });

  it('should not throw if emit is not a function', async () => {
    const context = { emit: 42 } as any;
    await expect(logTelemetry(context)).resolves.toBeUndefined();
  });
});
