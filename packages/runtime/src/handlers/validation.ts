import type { Context } from '../context';
import type { ValidationError } from '../context';

/** Validation results these handlers own on the context. */
export interface ValidationState {
  passed?: boolean;
  errors?: ValidationError[];
}

/** Typed accessor for the validation state these handlers own on a context. */
export function getValidationState(context: Context): ValidationState | undefined {
  return context.validation as ValidationState | undefined;
}

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
      const val = context.inputs[key];
      if (typeof val === 'string') {
        // Simple XSS prevention
        context.inputs[key] = val.replace(/[<>]/g, '');
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
