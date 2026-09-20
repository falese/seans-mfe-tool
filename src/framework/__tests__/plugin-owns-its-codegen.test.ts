/**
 * A resolved plugin owns its codegen, and a plugin without one fails loudly
 * (ADR-097 Boundaries — the next step that ADR named).
 *
 * `resolveFrameworkVariant` hands the generator `templateVariant: plugin.id`,
 * and `renderFiles` looks that id up with `findVariant`. When the lookup misses
 * it falls back to `reactRspack` and emits an `unregistered-variant`
 * diagnostic — correct for the NO-PLUGIN path, which ADR-061 requires to stay
 * independently runnable, and wrong here: if a plugin resolved and its variant
 * is missing, the plugin is broken, and generating a complete React MFE from a
 * manifest that asked for something else is the worst available outcome. It is
 * also the exact failure ADR-092 §4 already had to fix once in this function.
 *
 * The third-party plugins below are virtual mocks rather than spies on the
 * shipped ones, deliberately: `loadFrameworkPlugin` resolves a BUILT-IN by
 * path (`packages/framework-react`, which loads `dist/`) while the test's own
 * `require('@seans-mfe/framework-react')` is mapped to `src/`. Those are two
 * module instances — the reason `__frameworkPluginBrand` exists — so a spy on
 * one would never see a call through the other. Going through node resolution
 * keeps everything in one realm and makes the assertion about behaviour rather
 * than object identity.
 */

jest.mock(
  '@seans-mfe/framework-spec',
  () => {
    const { registerVariant, reactRspack } = require('@seans-mfe/codegen');
    return {
      frameworkPlugin: {
        __frameworkPluginBrand: '__BaseFrameworkPlugin__',
        id: 'spec-bundler',
        displayName: 'Spec',
        framework: 'spec',
        bundler: 'bundler',
        targetId: 'web',
        directoryStructure: [],
        getTestExtension: () => '.test.ts',
        getSharedDependencies: () => [],
        checkEnvironment: async () => [],
        buildProduction: async () => ({ success: true, artifacts: [], duration_ms: 0, warnings: [], errors: [] }),
        registerCodegen(): void {
          registerVariant({ ...reactRspack, id: 'spec-bundler', framework: 'spec', bundler: 'bundler' });
        },
      },
    };
  },
  { virtual: true },
);

jest.mock(
  '@seans-mfe/framework-ghost',
  () => ({
    frameworkPlugin: {
      __frameworkPluginBrand: '__BaseFrameworkPlugin__',
      id: 'ghost-bundler',
      displayName: 'Ghost',
      framework: 'ghost',
      bundler: 'bundler',
      targetId: 'web',
      directoryStructure: [],
      getTestExtension: () => '.test.ts',
      getSharedDependencies: () => [],
      checkEnvironment: async () => [],
      buildProduction: async () => ({ success: true, artifacts: [], duration_ms: 0, warnings: [], errors: [] }),
      // NOTE: no registerCodegen, and nothing registers `ghost-bundler`.
    },
  }),
  { virtual: true },
);

import { resolveFrameworkVariant } from '../loader';
import { findVariant, unregisterVariant } from '@seans-mfe/codegen';
import { ValidationError } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';

const manifest = (over: Partial<DSLManifest>): DSLManifest =>
  ({ name: 'probe', version: '1.0.0', type: 'remote', capabilities: [], ...over }) as DSLManifest;

describe('the shipped plugins declare their own codegen', () => {
  // Uniform with framework-swift, which has done this since ADR-097. Before
  // this change the two web plugins were the only ones whose codegen was
  // registered somewhere other than the plugin.
  it.each([
    ['react', 'react-rspack'],
    ['angular', 'angular-webpack'],
  ])('%s implements registerCodegen() and registers its own variant', (framework, variantId) => {
    const { frameworkPlugin } = require(`@seans-mfe/framework-${framework}`);
    expect(typeof frameworkPlugin.registerCodegen).toBe('function');

    frameworkPlugin.registerCodegen();

    const variant = findVariant(variantId);
    expect(variant).toBeDefined();
    expect(variant!.id).toBe(variantId);
    expect(variant!.framework).toBe(framework);
  });
});

describe('resolveFrameworkVariant registers the plugin’s codegen', () => {
  afterEach(() => unregisterVariant('spec-bundler'));

  it('registers a third-party plugin’s variant on the way through', () => {
    // Nothing else registers `spec-bundler`, so this can only pass if the
    // loader called registerCodegen() — it is not satisfiable by the built-in
    // fallback the way a react/angular id would be.
    expect(findVariant('spec-bundler')).toBeUndefined();

    const resolved = resolveFrameworkVariant(manifest({ framework: 'spec' }));

    expect(resolved.templateVariant).toBe('spec-bundler');
    expect(resolved.framework).toBe('spec');
    expect(findVariant('spec-bundler')).toBeDefined();
  });

  it('carries the id through as an open string, not the two built-in literals', () => {
    // `templateVariant` is typed `string` (ADR-093) but this function cast it
    // to `'react-rspack' | 'angular-webpack'` — a lie the compiler could not
    // catch, because the built-in ids happen to satisfy it.
    const resolved = resolveFrameworkVariant(manifest({ framework: 'spec' }));
    expect(resolved.templateVariant).toBe('spec-bundler');
  });
});

describe('a resolved plugin with no variant fails instead of generating React', () => {
  it('throws a ValidationError naming the plugin and the missing id', () => {
    expect(findVariant('ghost-bundler')).toBeUndefined();
    expect(() => resolveFrameworkVariant(manifest({ framework: 'ghost' }))).toThrow(ValidationError);
  });

  it('names the plugin, its id, and the fix', () => {
    let message = '';
    try {
      resolveFrameworkVariant(manifest({ framework: 'ghost' }));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/Ghost/);
    expect(message).toMatch(/ghost-bundler/);
    expect(message).toMatch(/registerCodegen/);
  });
});

describe('codegen keeps its own no-plugin fallback (ADR-061)', () => {
  it('still resolves the built-in variants without any plugin involvement', () => {
    // The generator must stay independently runnable; this change is to the
    // CLI resolution path only.
    expect(findVariant('react-rspack')).toBeDefined();
    expect(findVariant('angular-webpack')).toBeDefined();
  });
});
