import { rateLimitCheck } from '../rate-limiting';

describe('platform.rateLimitCheck', () => {
  it('should emit telemetry with limit', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock } as any;
    await rateLimitCheck(context, { limit: 10 });
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'telemetry', eventData: expect.objectContaining({ limit: 10 }) }));
  });
});
