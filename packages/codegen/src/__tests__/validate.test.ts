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

  // ── slots-implemented (ADR-073) ───────────────────────────────────────────
  // The slot half of #296. A slot declared in providesSlots that no component
  // registers is not a loud failure — ADR-066 parks a placement aimed at it and
  // waits forever — so it needs a design-time rule. It lives here, in the same
  // rule set, rather than in a second command wearing the same name.

  it('passes when every declared slot is referenced in source', () => {
    const input = consistentInput();
    input.manifest = reactManifest({ 'design-system': { 'styled-components': '^6.1.0' } });
    (input.manifest as unknown as { providesSlots: unknown }).providesSlots = [
      { id: 'main' },
      { id: 'berth.{id}' },
    ];
    input.sources = [
      { path: 'src/Console.tsx', text: '<DeclaredSlot id="main" /> id={`berth.${b}`}' },
    ];
    const res = validateMfeConsistency(input);
    expect(res.checked).toContain('slots-implemented');
    expect(res.issues.map((i) => i.rule)).not.toContain('slots-implemented');
  });

  it('flags a declared slot no source registers', () => {
    const input = consistentInput();
    (input.manifest as unknown as { providesSlots: unknown }).providesSlots = [
      { id: 'main' },
      { id: 'ghost' },
    ];
    input.sources = [{ path: 'src/Console.tsx', text: '<DeclaredSlot id="main" />' }];
    const res = validateMfeConsistency(input);
    expect(res.ok).toBe(false);
    const slotIssues = res.issues.filter((i) => i.rule === 'slots-implemented');
    expect(slotIssues).toHaveLength(1);
    expect(slotIssues[0].package).toBe('ghost');
  });

  it('skips the slot rule entirely when the manifest declares no slots', () => {
    const input = consistentInput();
    input.sources = [{ path: 'src/App.tsx', text: '' }];
    const res = validateMfeConsistency(input);
    expect(res.checked).not.toContain('slots-implemented');
  });

  it('skips the slot rule when sources were not supplied', () => {
    // The pure function must stay usable without the command layer's file IO.
    const input = consistentInput();
    (input.manifest as unknown as { providesSlots: unknown }).providesSlots = [{ id: 'main' }];
    const res = validateMfeConsistency(input);
    expect(res.checked).not.toContain('slots-implemented');
  });

  // Codegen always keys the generated stub method / handler-registry.ts DI
  // entry by the hook's own YAML key. The runtime always resolves a hook by
  // its `handler:` field. Nothing enforces the two agree — every real example
  // in the fleet just happens to keep them identical. #339-adjacent finding
  // from the base-mfe demo (docs/platform-design-review/base-mfe-architecture-and-demo.md).
  describe('lifecycle-hook-handler-resolvable', () => {
    function withHook(hookKey: string, hookConfig: Record<string, unknown>): DSLManifest {
      const manifest = reactManifest();
      (manifest as unknown as { capabilities: unknown[] }).capabilities = [
        {
          Load: {
            type: 'platform',
            lifecycle: { before: [{ [hookKey]: hookConfig }] },
          },
        },
      ];
      return manifest;
    }

    it('passes when handler matches the hook key', () => {
      const input = consistentInput();
      input.manifest = withHook('onLoadBegin', { handler: 'onLoadBegin' });
      const res = validateMfeConsistency(input);
      expect(res.checked).toContain('lifecycle-hook-handler-resolvable');
      expect(res.issues.map((i) => i.rule)).not.toContain('lifecycle-hook-handler-resolvable');
    });

    it('flags a handler that does not match the hook key — codegen names the stub after the key', () => {
      const input = consistentInput();
      input.manifest = withHook('onLoadBegin', { handler: 'validateWidgetConfig' });
      const res = validateMfeConsistency(input);
      expect(res.ok).toBe(false);
      const found = res.issues.filter((i) => i.rule === 'lifecycle-hook-handler-resolvable');
      expect(found).toHaveLength(1);
      expect(found[0].expected).toBe('onLoadBegin');
      expect(found[0].actual).toBe('validateWidgetConfig');
    });

    it('flags the mismatch even when source: is declared — handler-registry.ts is keyed by the hook key too', () => {
      const input = consistentInput();
      input.manifest = withHook('onLoadBegin', {
        handler: 'validateWidgetConfig',
        source: './handlers/validateWidgetConfig',
      });
      const res = validateMfeConsistency(input);
      const found = res.issues.filter((i) => i.rule === 'lifecycle-hook-handler-resolvable');
      expect(found).toHaveLength(1);
    });

    it('does not flag a platform.* handler — resolved from the static library, never codegen-named', () => {
      const input = consistentInput();
      input.manifest = withHook('onLoadBegin', { handler: 'platform.auth' });
      const res = validateMfeConsistency(input);
      expect(res.issues.map((i) => i.rule)).not.toContain('lifecycle-hook-handler-resolvable');
    });

    it('does not flag a custom.-prefixed handler whose last segment matches the hook key', () => {
      const input = consistentInput();
      input.manifest = withHook('onLoadBegin', { handler: 'custom.onLoadBegin' });
      const res = validateMfeConsistency(input);
      expect(res.issues.map((i) => i.rule)).not.toContain('lifecycle-hook-handler-resolvable');
    });

    it('flags a custom.-prefixed handler whose last segment does not match the hook key', () => {
      const input = consistentInput();
      input.manifest = withHook('onLoadBegin', { handler: 'custom.somethingElse' });
      const res = validateMfeConsistency(input);
      const found = res.issues.filter((i) => i.rule === 'lifecycle-hook-handler-resolvable');
      expect(found).toHaveLength(1);
    });

    it('checks every entry when handler is an array (REQ-045)', () => {
      const input = consistentInput();
      input.manifest = withHook('onLoadBegin', { handler: ['onLoadBegin', 'somethingElse'] });
      const res = validateMfeConsistency(input);
      const found = res.issues.filter((i) => i.rule === 'lifecycle-hook-handler-resolvable');
      expect(found).toHaveLength(1);
      expect(found[0].actual).toBe('somethingElse');
    });

    it('does not error on a manifest with no capabilities at all', () => {
      const input = consistentInput();
      input.manifest = reactManifest();
      const res = validateMfeConsistency(input);
      expect(res.checked).toContain('lifecycle-hook-handler-resolvable');
      expect(res.issues.map((i) => i.rule)).not.toContain('lifecycle-hook-handler-resolvable');
    });

    it('does not error on a capability with no lifecycle', () => {
      const input = consistentInput();
      const manifest = reactManifest();
      (manifest as unknown as { capabilities: unknown[] }).capabilities = [
        { AnalyzeUsage: { type: 'domain' } },
      ];
      input.manifest = manifest;
      const res = validateMfeConsistency(input);
      expect(res.issues.map((i) => i.rule)).not.toContain('lifecycle-hook-handler-resolvable');
    });
  });
});
