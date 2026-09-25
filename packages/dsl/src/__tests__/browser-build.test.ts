/**
 * The Rust target's browser build, as the rest of the platform addresses it
 * (ADR-100, ADR-103).
 *
 * Two sides have to agree on these values and neither reads the other's
 * output: the Rust codegen writes the scope into the generated
 * `remoteEntry.js`, and the composition compiler writes it into `rules.json`.
 * A mismatch is `Module "./App" does not exist in container` at runtime —
 * ADR-074's failure again — so the rule lives once, here.
 */

import type { DSLManifest } from '../schema';
import {
  BROWSER_BUILD_PATH,
  browserBuildOf,
  rustCrateName,
  rustWasmScope,
} from '../browser-build';

function manifest(overrides: Partial<DSLManifest> = {}): DSLManifest {
  return {
    name: 'meridian-crew-services',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    endpoint: 'http://localhost:5005',
    remoteEntry: 'http://localhost:5005/remoteEntry.js',
    capabilities: [
      { CrewRoster: { type: 'domain' } },
      { PayStatus: { type: 'domain' } },
      { Load: { type: 'platform' } },
    ],
    targets: { rust: { wasm: true } },
    ...overrides,
  } as DSLManifest;
}

describe('rustCrateName / rustWasmScope', () => {
  it('uses the manifest name, and `-` → `_` plus `_wasm` for the scope', () => {
    expect(rustCrateName(manifest())).toBe('meridian-crew-services');
    expect(rustWasmScope(manifest())).toBe('meridian_crew_services_wasm');
  });

  it('prefers an explicit crateName', () => {
    const m = manifest({ targets: { rust: { crateName: 'crew_core', wasm: true } } } as Partial<DSLManifest>);
    expect(rustCrateName(m)).toBe('crew_core');
    expect(rustWasmScope(m)).toBe('crew_core_wasm');
  });

  it('makes an illegal name a legal Cargo package name', () => {
    expect(rustCrateName(manifest({ name: '9lives.app' }))).toBe('mfe-9lives-app');
    expect(rustWasmScope(manifest({ name: '9lives.app' }))).toBe('mfe_9lives_app_wasm');
  });
});

describe('browserBuildOf', () => {
  it('is undefined without targets.rust.wasm', () => {
    expect(browserBuildOf(manifest({ targets: undefined } as Partial<DSLManifest>))).toBeUndefined();
    expect(browserBuildOf(manifest({ targets: { rust: {} } } as Partial<DSLManifest>))).toBeUndefined();
    expect(browserBuildOf(manifest({ targets: { rust: { wasm: false } } } as Partial<DSLManifest>))).toBeUndefined();
  });

  it('names the build <name>-wasm and serves it under the MFE endpoint', () => {
    expect(BROWSER_BUILD_PATH).toBe('wasm');
    expect(browserBuildOf(manifest())).toEqual({
      name: 'meridian-crew-services-wasm',
      scope: 'meridian_crew_services_wasm',
      remoteEntryUrl: 'http://localhost:5005/wasm/remoteEntry.js',
      capabilities: ['CrewRoster', 'PayStatus'],
    });
  });

  it('tolerates a trailing slash on the endpoint', () => {
    expect(browserBuildOf(manifest({ endpoint: 'http://localhost:5005/' }))?.remoteEntryUrl).toBe(
      'http://localhost:5005/wasm/remoteEntry.js'
    );
  });

  it('has no remote entry URL when the manifest has no endpoint', () => {
    expect(browserBuildOf(manifest({ endpoint: undefined }))?.remoteEntryUrl).toBeUndefined();
  });

  it('implements only the targets.rust.capabilities subset, dropping names the manifest does not declare', () => {
    const m = manifest({ targets: { rust: { wasm: true, capabilities: ['PayStatus', 'Ghost'] } } } as Partial<DSLManifest>);
    expect(browserBuildOf(m)?.capabilities).toEqual(['PayStatus']);
  });
});
