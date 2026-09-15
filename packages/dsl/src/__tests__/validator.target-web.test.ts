/**
 * The web build may be spelled twice; it may not be spelled twice differently
 * (ADR-095 §6).
 *
 * Silently picking a winner between two sources of one fact is the defect class
 * this repo keeps paying for — `getTemplateDir()` pointing at a deleted
 * directory, four capability arrays two entries short. So this is an error, not
 * a precedence rule.
 */
import { validateFull } from '../validator';

const base = {
  name: 'probe',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Health: { type: 'platform', description: 'h' } }],
};

describe('targets.web vs the top-level scalars', () => {
  it('accepts targets.web alone', () => {
    expect(validateFull({ ...base, targets: { web: { framework: 'react', bundler: 'rspack' } } }).valid).toBe(true);
  });

  it('accepts the scalars alone', () => {
    expect(validateFull({ ...base, framework: 'react', bundler: 'rspack' }).valid).toBe(true);
  });

  it('accepts both when they agree', () => {
    const r = validateFull({
      ...base, framework: 'react', bundler: 'rspack',
      targets: { web: { framework: 'react', bundler: 'rspack' } },
    });
    expect(r.valid).toBe(true);
  });

  it('REJECTS a disagreeing framework, naming both values', () => {
    const r = validateFull({
      ...base, framework: 'react',
      targets: { web: { framework: 'angular' } },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.map(e => e.code)).toContain('target_web_conflict');
    expect(r.errors[0].message).toMatch(/react/);
    expect(r.errors[0].message).toMatch(/angular/);
  });

  it('REJECTS a disagreeing bundler', () => {
    const r = validateFull({
      ...base, bundler: 'rspack',
      targets: { web: { bundler: 'webpack' } },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.map(e => e.code)).toContain('target_web_conflict');
  });

  it('does not fire when only one side declares the field', () => {
    const r = validateFull({
      ...base, framework: 'react',
      targets: { web: { bundler: 'rspack' } },
    });
    expect(r.valid).toBe(true);
  });
});
