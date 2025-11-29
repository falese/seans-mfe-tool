import { handleError } from '../error-handling';

describe('platform.handleError', () => {
  it('should emit error telemetry', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock } as any;
    const error = new Error('fail');
    await handleError(context, error);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'error', eventData: expect.objectContaining({ error: 'fail' }) }));
  });
});
