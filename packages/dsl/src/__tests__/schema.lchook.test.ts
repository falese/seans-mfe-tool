import { LifecycleHookSchema, PLATFORM_WRAPPER_METHODS } from '../schema';
import { z } from 'zod';

describe('LifecycleHookSchema handler reference validation', () => {
  it('accepts valid user-defined handler string', () => {
    const hook = { handler: 'customHandler' };
    expect(() => LifecycleHookSchema.parse(hook)).not.toThrow();
  });

  it('accepts valid user-defined handler array', () => {
    const hook = { handler: ['customHandler1', 'customHandler2'] };
    expect(() => LifecycleHookSchema.parse(hook)).not.toThrow();
  });

  it('rejects forbidden platform wrapper handler string', () => {
    for (const forbidden of PLATFORM_WRAPPER_METHODS) {
      const hook = { handler: forbidden };
      expect(() => LifecycleHookSchema.parse(hook)).toThrow(
        new RegExp(`Handler must not reference platform wrapper methods`)
      );
    }
  });

  it('rejects forbidden platform wrapper handler in array', () => {
    for (const forbidden of PLATFORM_WRAPPER_METHODS) {
      const hook = { handler: ['customHandler', forbidden] };
      expect(() => LifecycleHookSchema.parse(hook)).toThrow(
        new RegExp(`Handler must not reference platform wrapper methods`)
      );
    }
  });

  it('accepts empty handler array', () => {
    const hook = { handler: [] };
    expect(() => LifecycleHookSchema.parse(hook)).not.toThrow();
  });

  it('accepts handler with extra fields', () => {
    const hook = { handler: 'customHandler', description: 'desc', mandatory: true, contained: false };
    expect(() => LifecycleHookSchema.parse(hook)).not.toThrow();
  });
});
