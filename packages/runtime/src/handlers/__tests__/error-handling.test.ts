import { handleError, getErrorHandlingState } from '../error-handling';

describe('getErrorHandlingState', () => {
  it('returns context.errorHandling typed as ErrorHandlingState', () => {
    const context = { errorHandling: { recoverable: true, retryStrategy: 'exponential' } } as any;
    expect(getErrorHandlingState(context)).toEqual({ recoverable: true, retryStrategy: 'exponential' });
  });

  it('returns undefined when context.errorHandling is not set', () => {
    const context = {} as any;
    expect(getErrorHandlingState(context)).toBeUndefined();
  });
});

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

  it('falls back to context.error when no explicit error argument is given (ADR-076)', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock, error: new Error('from-context') } as any;
    await handleError(context);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ error: 'from-context' }) }));
  });

  it('falls back to a generic error when neither an argument nor context.error is present', async () => {
    const emitMock = jest.fn();
    const context = { emit: emitMock } as any;
    await handleError(context);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ error: 'Unknown error' }) }));
  });
});
