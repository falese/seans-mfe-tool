import { validateInputs, sanitizeInputs, getValidationState } from '../validation';

describe('getValidationState', () => {
  it('returns context.validation typed as ValidationState', () => {
    const context = { validation: { passed: false, errors: [] } } as any;
    expect(getValidationState(context)).toEqual({ passed: false, errors: [] });
  });

  it('returns undefined when context.validation is not set', () => {
    const context = {} as any;
    expect(getValidationState(context)).toBeUndefined();
  });
});

describe('platform.validateInputs', () => {
  it('should throw if inputs are missing', async () => {
    const context = { emit: jest.fn() } as any;
    await expect(validateInputs(context)).rejects.toThrow('Inputs required');
  });
  it('should emit telemetry if inputs are present', async () => {
    const emitMock = jest.fn();
    const context = { inputs: { foo: 'bar' }, emit: emitMock } as any;
    await validateInputs(context);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'validation.inputs.validate', status: 'success' }));
  });

  it('should not throw if emit is not a function', async () => {
    const context = { inputs: { foo: 'bar' }, emit: 42 } as any;
    await expect(validateInputs(context)).resolves.toBeUndefined();
  });
});

describe('platform.sanitizeInputs', () => {
  it('should sanitize string inputs', async () => {
    const emitMock = jest.fn();
    const context = { inputs: { foo: '<bar>' }, emit: emitMock } as any;
    await sanitizeInputs(context);
    expect(context.inputs.foo).toBe('bar');
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'validation.inputs.sanitize', status: 'success' }));
  });

  it('should not throw if emit is not a function', async () => {
    const context = { inputs: { foo: '<bar>' }, emit: 42 } as any;
    await expect(sanitizeInputs(context)).resolves.toBeUndefined();
    expect(context.inputs.foo).toBe('bar');
  });
});
