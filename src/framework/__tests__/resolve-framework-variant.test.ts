/**
 * `resolveFrameworkVariant` must carry the author's framework name through to
 * plugin resolution (ADR-036).
 *
 * `loadFrameworkPlugin` already supports a third-party framework: it falls back
 * to `require('@seans-mfe/framework-<name>')` and, when that is not installed,
 * throws a ValidationError naming the package to install. `loader.test.ts`
 * pins that behaviour — but only by calling `loadFrameworkPlugin` directly.
 *
 * Nothing pinned the path an actual manifest takes, which is
 * `resolveFrameworkVariant`. That gap is why a change there could route every
 * non-Angular framework to React without a single test failing: `vue` did not
 * fail to resolve, it silently resolved to the React plugin, which is worse.
 *
 * These tests exercise the manifest path, so the open-world contract is held
 * where manifests actually enter it.
 */

import { resolveFrameworkVariant } from '../loader';
import { ValidationError } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';

const manifest = (over: Partial<DSLManifest>): DSLManifest =>
  ({ name: 'probe', version: '1.0.0', type: 'remote', capabilities: [], ...over }) as DSLManifest;

describe('resolveFrameworkVariant', () => {
  describe('built-in frameworks', () => {
    it('resolves react', () => {
      expect(resolveFrameworkVariant(manifest({ framework: 'react' })).framework).toBe('react');
    });

    it('resolves angular', () => {
      expect(resolveFrameworkVariant(manifest({ framework: 'angular' })).framework).toBe('angular');
    });

    it('falls back to angular for a webpack manifest with no framework', () => {
      expect(resolveFrameworkVariant(manifest({ bundler: 'webpack' })).framework).toBe('angular');
    });

    it('falls back to react when neither field is present', () => {
      expect(resolveFrameworkVariant(manifest({})).framework).toBe('react');
    });
  });

  describe('a framework this repo does not ship (ADR-036 open schema)', () => {
    // The defect this guards against is silence, not failure. A manifest that
    // names an uninstalled framework must say so; resolving it to React
    // generates a complete, working, WRONG MFE — rspack config, .tsx entry
    // points and all — from a manifest that asked for something else.
    it.each(['vue', 'svelte', 'solid'])(
      'does not silently substitute a built-in plugin for "%s"',
      (framework) => {
        expect(() => resolveFrameworkVariant(manifest({ framework }))).toThrow(ValidationError);
      },
    );

    it('names the package to install', () => {
      expect(() => resolveFrameworkVariant(manifest({ framework: 'vue' }))).toThrow(
        /@seans-mfe\/framework-vue/,
      );
    });
  });
});
