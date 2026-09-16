/**
 * Two spellings for the web build, one resolution rule (ADR-095 §6, ADR-092 §4).
 *
 *     framework: react            targets:
 *     bundler: rspack        ≡      web: { framework: react, bundler: rspack }
 *
 * The scalars came first and every example manifest uses them; `targets.web`
 * exists so a manifest can name every build it produces in ONE list instead of
 * privileging the web one structurally. Both must resolve identically, and a
 * manifest that states the fact twice and differently must be rejected rather
 * than silently resolved.
 */
import { resolveWebTarget, resolveFrameworkName, resolveBundlerName } from '../unified-generator';
import type { DSLManifest } from '@seans-mfe/dsl';

const base = {
  name: 'probe',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Health: { type: 'platform', description: 'h' } }],
};

const m = (o: Record<string, unknown>) => ({ ...base, ...o }) as unknown as DSLManifest;

describe('the two spellings agree', () => {
  it('resolves the scalar spelling', () => {
    expect(resolveWebTarget(m({ framework: 'react', bundler: 'rspack' })))
      .toEqual({ framework: 'react', bundler: 'rspack' });
  });

  it('resolves the targets.web spelling identically', () => {
    expect(resolveWebTarget(m({ targets: { web: { framework: 'react', bundler: 'rspack' } } })))
      .toEqual({ framework: 'react', bundler: 'rspack' });
  });

  it('resolves an Angular manifest either way', () => {
    const scalar = resolveWebTarget(m({ framework: 'angular', bundler: 'webpack' }));
    const listed = resolveWebTarget(m({ targets: { web: { framework: 'angular', bundler: 'webpack' } } }));
    expect(scalar).toEqual(listed);
    expect(scalar).toEqual({ framework: 'angular', bundler: 'webpack' });
  });

  it('carries a third-party framework name through untouched', () => {
    // The trap ADR-092 §4 names: collapsing an unknown name to react turns a
    // third-party plugin into a silent React build.
    expect(resolveFrameworkName(m({ targets: { web: { framework: 'vue' } } }))).toBe('vue');
  });
});

describe('back-compat defaults are unchanged', () => {
  it('defaults to react + rspack when nothing is declared', () => {
    expect(resolveWebTarget(m({}))).toEqual({ framework: 'react', bundler: 'rspack' });
  });

  it('still lets bundler:webpack select angular', () => {
    expect(resolveFrameworkName(m({ bundler: 'webpack' }))).toBe('angular');
    expect(resolveFrameworkName(m({ targets: { web: { bundler: 'webpack' } } }))).toBe('angular');
  });

  it('derives the bundler from an explicit framework', () => {
    expect(resolveBundlerName(m({ framework: 'angular' }))).toBe('webpack');
    expect(resolveBundlerName(m({ framework: 'react' }))).toBe('rspack');
  });
});

describe('targets.web wins where both agree', () => {
  it('accepts the redundant-but-consistent case', () => {
    expect(resolveFrameworkName(m({ framework: 'react', targets: { web: { framework: 'react' } } })))
      .toBe('react');
  });
});

describe('a secondary target does not affect web resolution', () => {
  it('ignores targets.swift', () => {
    expect(resolveWebTarget(m({ framework: 'react', targets: { swift: {}, web: { bundler: 'rspack' } } })))
      .toEqual({ framework: 'react', bundler: 'rspack' });
  });
});
