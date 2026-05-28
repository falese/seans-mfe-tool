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

describe('LifecycleHookSchema handler source resolution (ADR-072)', () => {
  it('accepts a relative-path source', () => {
    const hook = { handler: 'validateInput', source: './handlers/validation.ts' };
    expect(() => LifecycleHookSchema.parse(hook)).not.toThrow();
  });

  it('accepts a module+export source', () => {
    const hook = { handler: 'validateEmail', source: '@my-org/shared-handlers#validateEmail' };
    expect(() => LifecycleHookSchema.parse(hook)).not.toThrow();
  });

  it('accepts a bare module source (resolves to default export)', () => {
    const hook = { handler: 'logBegin', source: '@my-org/shared-handlers' };
    expect(() => LifecycleHookSchema.parse(hook)).not.toThrow();
  });

  it('rejects empty source string', () => {
    const hook = { handler: 'validateInput', source: '' };
    expect(() => LifecycleHookSchema.parse(hook)).toThrow(/source/i);
  });

  it('rejects source on a hook whose handler references a platform wrapper method', () => {
    const hook = { handler: 'doLoad', source: './handlers/x.ts' };
    expect(() => LifecycleHookSchema.parse(hook)).toThrow(
      /Handler must not reference platform wrapper methods/
    );
  });

  it('treats source as optional — omitting it is unchanged behaviour', () => {
    const hook = { handler: 'customHandler' };
    const parsed = LifecycleHookSchema.parse(hook);
    expect((parsed as any).source).toBeUndefined();
  });
});
