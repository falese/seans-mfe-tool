/**
 * loadFrameworkPlugin() — resolution utility tests (ADR-071, #169).
 */

import { BaseFrameworkPlugin, ValidationError } from '@seans-mfe/contracts';
import { loadFrameworkPlugin } from '../loader';

describe('loadFrameworkPlugin', () => {
  it('resolves the react plugin', () => {
    const plugin = loadFrameworkPlugin('react');
    expect(plugin).toBeInstanceOf(BaseFrameworkPlugin);
    expect(plugin.id).toBe('react-rspack');
    expect(plugin.framework).toBe('react');
    expect(plugin.bundler).toBe('rspack');
  });

  it('resolves the angular plugin', () => {
    const plugin = loadFrameworkPlugin('angular');
    expect(plugin).toBeInstanceOf(BaseFrameworkPlugin);
    expect(plugin.id).toBe('angular-webpack');
    expect(plugin.framework).toBe('angular');
    expect(plugin.bundler).toBe('webpack');
  });

  it('throws ValidationError for unknown framework', () => {
    expect(() => loadFrameworkPlugin('vue')).toThrow(ValidationError);
    expect(() => loadFrameworkPlugin('vue')).toThrow(/not available/);
  });

  it('returns the same singleton instance on repeated calls', () => {
    const a = loadFrameworkPlugin('react');
    const b = loadFrameworkPlugin('react');
    expect(a).toBe(b);
  });

  it('provides install hint in error message', () => {
    try {
      loadFrameworkPlugin('svelte');
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toMatch(/@seans-mfe\/framework-svelte/);
    }
  });

  it('returns plugins with correct default ports', () => {
    expect(loadFrameworkPlugin('react').defaultPort).toBe(3001);
    expect(loadFrameworkPlugin('angular').defaultPort).toBe(3101);
  });
});
