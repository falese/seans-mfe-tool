import { validateInputs, sanitizeInputs } from '../validation';

describe('platform.validateInputs', () => {
  it('should throw if inputs are missing', async () => {
    const context = { emit: jest.fn() } as any;
    await expect(validateInputs(context)).rejects.toThrow('Inputs required');
  });
  it('should emit telemetry if inputs are present', async () => {
    const emitMock = jest.fn();
    const context = { inputs: { foo: 'bar' }, emit: emitMock } as any;
    await validateInputs(context);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'telemetry' }));
  });
});

describe('platform.sanitizeInputs', () => {
  it('should sanitize string inputs', async () => {
    const emitMock = jest.fn();
    const context = { inputs: { foo: '<bar>' }, emit: emitMock } as any;
    await sanitizeInputs(context);
    expect(context.inputs.foo).toBe('bar');
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'telemetry' }));
  });
});
