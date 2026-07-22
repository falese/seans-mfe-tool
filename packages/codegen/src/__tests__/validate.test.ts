import { validateMfeConsistency, parseFederationSharedEntries } from '../validate';
import { DEPENDENCY_VERSIONS } from '../unified-generator';
import type { DSLManifest } from '@seans-mfe/dsl';

const RUNTIME = '@seans-mfe-tool/runtime';

function reactManifest(deps: Record<string, unknown> = {}): DSLManifest {
  return {
    name: 'demo',
    version: '1.0.0',
    framework: 'react',
    dependencies: deps,
  } as unknown as DSLManifest;
}

/** A package.json + rspack shared set that is fully consistent with the manifest. */
function consistentInput(): Parameters<typeof validateMfeConsistency>[0] {
  return {
    manifest: reactManifest({ 'design-system': { 'styled-components': '^6.1.0' } }),
    framework: 'react',
    packageDependencies: {
      react: DEPENDENCY_VERSIONS.react.react,
      'react-dom': DEPENDENCY_VERSIONS.react.reactDom,
      'styled-components': '^6.1.0',
      [RUNTIME]: DEPENDENCY_VERSIONS.runtime.package,
    },
    sharedEntries: [
      { name: 'react', requiredVersion: DEPENDENCY_VERSIONS.react.react },
      { name: 'react-dom', requiredVersion: DEPENDENCY_VERSIONS.react.reactDom },
      { name: 'styled-components', requiredVersion: '^6.1.0' },
    ],
  };
}

describe('validateMfeConsistency', () => {
  it('passes a fully consistent MFE', () => {
    const res = validateMfeConsistency(consistentInput());
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it('flags react/react-dom not pinned to the platform version', () => {
    const input = consistentInput();
    input.packageDependencies.react = '^19.0.0';
    const res = validateMfeConsistency(input);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.rule)).toContain('react-pinned');
  });

  it('flags a manifest dependency missing from package.json', () => {
    const input = consistentInput();
    delete input.packageDependencies['styled-components'];
    const res = validateMfeConsistency(input);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.rule)).toContain('manifest-package-sync');
  });

  it('flags a manifest dependency whose package.json version differs', () => {
    const input = consistentInput();
    input.packageDependencies['styled-components'] = '^5.0.0';
    const res = validateMfeConsistency(input);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.rule)).toContain('manifest-package-sync');
  });

  it('flags a federation shared key that is not a declared dependency', () => {
    const input = consistentInput();
    input.sharedEntries.push({ name: '@babylonjs/core', requiredVersion: '^9.17.0' });
    const res = validateMfeConsistency(input);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.rule)).toContain('shared-declared');
  });

  it('flags a shared react version that diverges from the platform version', () => {
    const input = consistentInput();
    input.sharedEntries[0] = { name: 'react', requiredVersion: '^18.2.0' };
    const res = validateMfeConsistency(input);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.rule)).toContain('shared-version-sync');
  });

  it('flags a missing runtime dependency', () => {
    const input = consistentInput();
    delete input.packageDependencies[RUNTIME];
    const res = validateMfeConsistency(input);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.rule)).toContain('runtime-declared');
  });

  it('parses federation shared entries from rspack config source', () => {
    const src = `
      new ModuleFederationPlugin({
        shared: {
          react: { singleton: true, requiredVersion: '~18.2.0', eager: true },
          'react-dom': { singleton: true, requiredVersion: '~18.2.0', eager: true },
          'styled-components': { singleton: true, requiredVersion: '^6.1.0', eager: true }
        }
      })`;
    expect(parseFederationSharedEntries(src)).toEqual([
      { name: 'react', requiredVersion: '~18.2.0' },
      { name: 'react-dom', requiredVersion: '~18.2.0' },
      { name: 'styled-components', requiredVersion: '^6.1.0' },
    ]);
  });

  it('ignores shared entries without a requiredVersion', () => {
    const src = `shared: { ...deps, react: { singleton: true } }`;
    expect(parseFederationSharedEntries(src)).toEqual([]);
  });

  it('does not treat the enclosing `shared` block as an entry', () => {
    const src = `
      shared: {
        react: { singleton: true, requiredVersion: '~18.2.0' }
      }`;
    expect(parseFederationSharedEntries(src).map((e) => e.name)).toEqual(['react']);
  });

  it('does not require react pinning for angular MFEs', () => {
    const res = validateMfeConsistency({
      manifest: { name: 'ng', version: '1.0.0', framework: 'angular', dependencies: {} } as unknown as DSLManifest,
      framework: 'angular',
      packageDependencies: { [RUNTIME]: DEPENDENCY_VERSIONS.runtime.package },
      sharedEntries: [],
    });
    expect(res.issues.map((i) => i.rule)).not.toContain('react-pinned');
  });
});
