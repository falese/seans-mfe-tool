import { cacheResult } from '../caching';

describe('platform.cacheResult', () => {
  it('should emit info with ttl', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock } as any;
    await cacheResult(context, { ttl: 123 });
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'info', eventData: expect.objectContaining({ ttl: 123 }) }));
  });
});
