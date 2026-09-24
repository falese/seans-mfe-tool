/**
 * The Rust target's browser build, as the rest of the platform addresses it
 * (ADR-100, ADR-103).
 *
 * A manifest with `targets.rust.wasm` produces a second Module Federation
 * remote beside its web one. Two sides must agree on how that remote is
 * named, and neither reads the other's output: the Rust codegen writes the
 * scope into the generated `remoteEntry.js`, and the composition compiler
 * writes it into `rules.json`. A mismatch is `Module "./App" does not exist
 * in container` at runtime — the failure ADR-074 pinned for the web build — so
 * the rule is here, below both (`packages/README.md`: codegen → dsl).
 */

import type { DSLManifest } from './schema';

/** The slice of a manifest the naming rules read — structural, so codegen's own manifest views satisfy it. */
export interface RustNamingInput {
  name: string;
  targets?: { rust?: { crateName?: string } };
}

type ManifestLike = Pick<DSLManifest, 'name'> & Partial<Pick<DSLManifest, 'endpoint' | 'capabilities' | 'targets'>>;

/**
 * Where an MFE's own server serves the browser build: `<endpoint>/wasm/`
 * (ADR-103 §2). One deployable, one origin, no second port.
 */
export const BROWSER_BUILD_PATH = 'wasm';

/** The registration name of a manifest's browser build: `<name>-wasm` (ADR-103 §1). */
export const BROWSER_BUILD_SUFFIX = '-wasm';

/**
 * Cargo package name: `targets.rust.crateName`, else the MFE name.
 *
 * Hyphens are legal in a package name, so kebab-case passes through; anything
 * else illegal becomes `-`, and a leading digit gets an `mfe-` prefix.
 */
export function rustCrateName(manifest: RustNamingInput): string {
  const explicit = manifest.targets?.rust?.crateName;
  if (explicit) return explicit;
  const raw = manifest.name.replace(/[^A-Za-z0-9_-]+/g, '-');
  return /^[0-9]/.test(raw) ? `mfe-${raw}` : raw;
}

/**
 * The Module Federation scope the browser build registers under.
 *
 * Deliberately NOT the web remote's scope (`name` with `-` → `_`): both builds
 * of one MFE must be able to sit on the same page, and a container is a global
 * keyed by scope (ADR-100).
 */
export function rustWasmScope(manifest: RustNamingInput): string {
  return `${rustCrateName(manifest).replace(/-/g, '_')}_wasm`;
}

/** A manifest's browser build, as the registry sees it. */
export interface BrowserBuild {
  /** `<name>-wasm` — what a placement's `from` names. */
  name: string;
  scope: string;
  /** `<endpoint>/wasm/remoteEntry.js`; absent when the manifest has no endpoint. */
  remoteEntryUrl?: string;
  /** The domain capabilities it implements — `targets.rust.capabilities`, else all. */
  capabilities: string[];
}

/** The browser build a manifest declares, or `undefined` without `targets.rust.wasm`. */
export function browserBuildOf(manifest: ManifestLike): BrowserBuild | undefined {
  const rust = manifest.targets?.rust;
  if (rust?.wasm !== true) return undefined;

  const domain = (manifest.capabilities ?? []).flatMap((entry) =>
    Object.entries(entry)
      .filter(([, config]) => config?.type === 'domain')
      .map(([name]) => name)
  );
  const capabilities = rust.capabilities ? rust.capabilities.filter((name) => domain.includes(name)) : domain;

  const build: BrowserBuild = {
    name: `${manifest.name}${BROWSER_BUILD_SUFFIX}`,
    scope: rustWasmScope(manifest),
    capabilities,
  };
  if (manifest.endpoint) {
    build.remoteEntryUrl = `${manifest.endpoint.replace(/\/+$/, '')}/${BROWSER_BUILD_PATH}/remoteEntry.js`;
  }
  return build;
}
