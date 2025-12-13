import { rateLimitCheck } from '../rate-limiting';

describe('platform.rateLimitCheck', () => {
  it('should emit telemetry with limit', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock } as any;
    await rateLimitCheck(context, { limit: 10 });
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'telemetry', eventData: expect.objectContaining({ limit: 10 }) }));
  });

  it('should not throw if emit is not a function', async () => {
    const context = { emit: 42 } as any;
    await expect(rateLimitCheck(context, { limit: 10 })).resolves.toBeUndefined();
  });

  it('should not throw if emit is missing', async () => {
    const context = {} as any;
    await expect(rateLimitCheck(context)).resolves.toBeUndefined();
  });
});
