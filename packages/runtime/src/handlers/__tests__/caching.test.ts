import { cacheResult } from '../caching';

describe('platform.cacheResult', () => {
  it('should emit info with ttl', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock } as any;
    await cacheResult(context, { ttl: 123 });
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'caching.result.cache', status: 'success', metadata: expect.objectContaining({ ttl: 123 }) }));
  });

  it('should not throw if emit is not a function', async () => {
    const context = { emit: 42 } as any;
    await expect(cacheResult(context, { ttl: 123 })).resolves.toBeUndefined();
  });

  it('should not throw if emit is missing', async () => {
    const context = {} as any;
    await expect(cacheResult(context)).resolves.toBeUndefined();
  });
});
