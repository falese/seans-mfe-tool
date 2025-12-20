import { Context } from '../base-mfe';
export async function validateInputs(context: Context): Promise<void> {
  // Example: validate required fields
  if (!context.inputs) {
    throw new Error('Inputs required');
  }
  // Add more validation logic as needed
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      name: 'validation.inputs.validate',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'success',
      metadata: { source: 'platform.validateInputs', inputs: context.inputs, severity: 'info' },
      timestamp: new Date(),
    });
  }
}

export async function sanitizeInputs(context: Context): Promise<void> {
  // Example: sanitize string inputs
  if (context.inputs) {
    for (const key of Object.keys(context.inputs)) {
      if (typeof context.inputs[key] === 'string') {
        // Simple XSS prevention
        context.inputs[key] = context.inputs[key].replace(/[<>]/g, '');
      }
    }
  }
  const emit = typeof context.emit === 'function' ? context.emit : undefined;
  if (emit) {
    await emit({
      name: 'validation.inputs.sanitize',
      capability: context.capability || 'unknown',
      phase: context.phase || 'unknown',
      status: 'success',
      metadata: { source: 'platform.sanitizeInputs', inputs: context.inputs, severity: 'info' },
      timestamp: new Date(),
    });
  }
}
