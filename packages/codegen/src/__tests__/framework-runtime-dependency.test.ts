/**
 * The framework runtime package is a real dependency of a generated MFE
 * (ADR-084).
 *
 * Before this, `@falese/smt-framework-react` could not be installed by a
 * generated MFE at all — it declared `"@falese/smt-contracts": "file:../contracts"`,
 * a path that resolves only inside this repo. The consequence was not a missing
 * feature but a duplicated one: codegen copied `DeclaredSlot`'s body into
 * `slots.tsx.ejs` because importing it was impossible, and the two copies were
 * kept in step by a comment no gate enforced.
 *
 * These tests pin the dependency itself. The drift gate pins what the template
 * emits; what neither can express is *why* the dependency has to be there, so
 * it is written down here.
 */
import { resolveClientDependencies } from '../unified-generator';
import type { DSLManifest } from '@falese/smt-dsl';

const manifest = (framework: string): DSLManifest =>
  ({
    name: 'widget',
    version: '1.0.0',
    framework,
    capabilities: [],
  }) as unknown as DSLManifest;

describe('generated MFEs depend on their framework runtime package (ADR-084)', () => {
  it('gives a React MFE @falese/smt-framework-react', () => {
    const deps = resolveClientDependencies(manifest('react'), 'react');
    expect(deps['@falese/smt-framework-react']).toBeDefined();
  });

  it('gives an Angular MFE the Angular package, never the React one', () => {
    const deps = resolveClientDependencies(manifest('angular'), 'angular');
    expect(deps['@falese/smt-framework-angular']).toBeDefined();
    // ADR-056's boundary is a bundle-size and correctness claim: an Angular MFE
    // that pulled the React package would drag React in through its slot sugar.
    expect(deps['@falese/smt-framework-react']).toBeUndefined();
  });

  it('pins the same range as the runtime, so the pair cannot skew', () => {
    const react = resolveClientDependencies(manifest('react'), 'react');
    const angular = resolveClientDependencies(manifest('angular'), 'angular');
    // Both packages are published from this repo at one version (ADR-083), so a
    // consumer resolving different majors of the two would be a packaging bug.
    expect(react['@falese/smt-framework-react']).toBe(angular['@falese/smt-framework-angular']);
  });

  it('adds nothing for an unknown framework rather than guessing', () => {
    // FrameworkSchema is deliberately open (ADR-036): unknown values warn, they
    // do not fail. Inventing a package name for one would emit an uninstallable
    // manifest.
    const deps = resolveClientDependencies(manifest('svelte'), 'svelte');
    expect(Object.keys(deps).filter((k) => k.startsWith('@falese/smt-framework-'))).toEqual([]);
  });
});
