/**
 * build:check command tests (ADR-071, #172).
 */

import { loadFrameworkPlugin } from '../../../framework/loader';

describe('build:check logic', () => {
  it('react plugin environment checks return structured results', async () => {
    const plugin = loadFrameworkPlugin('react');
    const checks = await plugin.checkEnvironment();

    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);

    for (const check of checks) {
      expect(check).toHaveProperty('tool');
      expect(check).toHaveProperty('required');
      expect(check).toHaveProperty('found');
      expect(check).toHaveProperty('ok');
      expect(typeof check.tool).toBe('string');
      expect(typeof check.required).toBe('string');
      expect(typeof check.ok).toBe('boolean');
    }
  });

  it('angular plugin environment checks return structured results', async () => {
    const plugin = loadFrameworkPlugin('angular');
    const checks = await plugin.checkEnvironment();

    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);

    for (const check of checks) {
      expect(check).toHaveProperty('tool');
      expect(check).toHaveProperty('required');
      expect(check).toHaveProperty('found');
      expect(check).toHaveProperty('ok');
    }
  });

  it('node check passes for both plugins', async () => {
    const react = loadFrameworkPlugin('react');
    const angular = loadFrameworkPlugin('angular');

    const reactChecks = await react.checkEnvironment();
    const angularChecks = await angular.checkEnvironment();

    const reactNode = reactChecks.find(c => c.tool === 'node');
    const angularNode = angularChecks.find(c => c.tool === 'node');

    expect(reactNode!.ok).toBe(true);
    expect(angularNode!.ok).toBe(true);
  });

  it('checks include fix suggestions for missing tools', async () => {
    const plugin = loadFrameworkPlugin('react');
    const checks = await plugin.checkEnvironment();
    const rspackCheck = checks.find(c => c.tool === 'rspack');
    expect(rspackCheck).toBeDefined();
    expect(rspackCheck!.fix).toBeDefined();
  });
});
