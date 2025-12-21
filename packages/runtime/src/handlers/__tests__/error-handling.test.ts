import { handleError } from '../error-handling';

describe('platform.handleError', () => {
  it('should emit error telemetry', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock } as any;
    const error = new Error('fail');
    await handleError(context, error);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'error.handling.handle', status: 'error', metadata: expect.objectContaining({ error: 'fail' }) }));
  });

  it('should not throw if emit is not a function', async () => {
    const context = { emit: 42 } as any;
    const error = new Error('fail');
    await expect(handleError(context, error)).resolves.toBeUndefined();
  });
});
