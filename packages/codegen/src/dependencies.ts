/**
 * Dependency resolution — which libraries a generated MFE declares, and which
 * of them Module Federation shares.
 *
 * ADR-071 is the rule: the manifest chooses WHICH libraries ship
 * (`dependencies.runtime` + `dependencies.design-system`), and ./catalog's
 * DEPENDENCY_VERSIONS decides WHICH VERSION (ADR-050). Neither answer is
 * hardcoded in a template. The render helpers at the bottom exist because EJS
 * templates cannot compute a trailing comma correctly on their own.
 *
 * Pure: no disk access, no rendering.
 */

import type { DSLManifest } from '@seans-mfe/dsl';
import { DEPENDENCY_VERSIONS } from './catalog';

// =============================
// Shared Utilities
// =============================

// Framework packages are single-sourced from platform defaults (#293), never
// re-emitted from manifest.dependencies.runtime — so they're stripped when we
// derive the "extra" runtime deps a manifest declares (babylon, zustand, …).
const REACT_FRAMEWORK_PACKAGES = new Set(['react', 'react-dom']);
const ANGULAR_FRAMEWORK_PACKAGES = new Set([
  '@angular/core',
  '@angular/common',
  '@angular/compiler',
  '@angular/compiler-cli',
  '@angular/forms',
  '@angular/platform-browser',
  '@angular/platform-browser-dynamic',
  'rxjs',
  'zone.js',
]);

/**
 * Resolve a React MFE's design-system dependencies (#294).
 *
 * The manifest is the source of truth:
 * - nothing declared            → the platform default (MUI + emotion peers);
 * - a declaration containing MUI → MUI stack, declared versions winning, so a
 *   bare `@mui/material: ^5.x` still ships the emotion peers it needs;
 * - a non-MUI declaration        → used verbatim (e.g. styled-components), so an
 *   MFE that opts out of MUI stops force-pulling it.
 */
export function resolveDesignSystemDeps(
  manifest: DSLManifest,
  framework: string
): Record<string, string> {
  const declared = (manifest.dependencies?.['design-system'] || {}) as Record<string, string>;
  if (framework !== 'react') {
    return { ...declared };
  }
  const keys = Object.keys(declared);
  const hasMui = keys.some((k) => k.startsWith('@mui/'));
  if (keys.length === 0 || hasMui) {
    return {
      '@mui/material': DEPENDENCY_VERSIONS.mui.material,
      '@mui/system': DEPENDENCY_VERSIONS.mui.system,
      '@emotion/react': DEPENDENCY_VERSIONS.mui.emotionReact,
      '@emotion/styled': DEPENDENCY_VERSIONS.mui.emotionStyled,
      // Declared versions (and any extra keys) win over the defaults.
      ...declared,
    };
  }
  return { ...declared };
}

/**
 * Non-framework runtime dependencies declared in the manifest (#294) — the libs
 * that previously had to be hand-added to package.json and then drifted.
 */
export function resolveRuntimeExtraDeps(
  manifest: DSLManifest,
  framework: string
): Record<string, string> {
  const runtime = (manifest.dependencies?.runtime || {}) as Record<string, string>;
  const frameworkPackages =
    framework === 'angular' ? ANGULAR_FRAMEWORK_PACKAGES : REACT_FRAMEWORK_PACKAGES;
  const out: Record<string, string> = {};
  for (const [name, version] of Object.entries(runtime)) {
    if (!frameworkPackages.has(name) && typeof version === 'string') {
      out[name] = version;
    }
  }
  return out;
}

/**
 * The full set of client-side dependencies for a React MFE's package.json,
 * derived from the manifest: framework singletons + design-system + extras.
 */
export function resolveClientDependencies(
  manifest: DSLManifest,
  framework: string
): Record<string, string> {
  const deps: Record<string, string> = {};
  if (framework === 'react') {
    deps['react'] = DEPENDENCY_VERSIONS.react.react;
    deps['react-dom'] = DEPENDENCY_VERSIONS.react.reactDom;
  }
  Object.assign(deps, resolveDesignSystemDeps(manifest, framework));
  Object.assign(deps, resolveRuntimeExtraDeps(manifest, framework));
  return deps;
}

/**
 * Which optional Mesh plugins/transforms a manifest's `data:`/`performance:`
 * config implies (ADR-027). Feeds `extractManifestVars`, which decides what
 * `package.json.ejs` and the BFF templates render.
 */
export function resolveNeededMeshPluginsAndTransforms(manifest: DSLManifest): {
  neededPlugins: string[];
  neededTransforms: string[];
} {
  const performanceConfig = manifest.performance || {};
  const observabilityConfig = performanceConfig.observability || {};

  const neededPlugins = new Set<string>();
  if (performanceConfig.caching?.enabled !== false) neededPlugins.add('responseCache');
  if (observabilityConfig.prometheus?.enabled !== false) neededPlugins.add('prometheus');
  if (observabilityConfig.opentelemetry?.enabled) neededPlugins.add('opentelemetry');

  const neededTransforms = new Set<string>();
  neededTransforms.add('namingConvention'); // Always include
  if (performanceConfig.rateLimit?.enabled) neededTransforms.add('rateLimit');
  if (performanceConfig.filterSchema?.enabled) neededTransforms.add('filterSchema');
  if (manifest.transforms && manifest.transforms.length > 0) neededTransforms.add('resolversComposition');
  // Demo-mode mock switch (ADR-052) is implemented as a resolversComposition transform.
  if (manifest.data?.mockSwitch?.enabled) neededTransforms.add('resolversComposition');

  return { neededPlugins: Array.from(neededPlugins), neededTransforms: Array.from(neededTransforms) };
}

/**
 * Module-federation `shared` deps for a React MFE (#294): framework singletons
 * plus the design-system — NOT arbitrary runtime libs, which are usually wrong
 * to force into a single shared instance.
 */
export function resolveReactSharedDeps(manifest: DSLManifest): Record<string, string> {
  return {
    react: DEPENDENCY_VERSIONS.react.react,
    'react-dom': DEPENDENCY_VERSIONS.react.reactDom,
    ...resolveDesignSystemDeps(manifest, 'react'),
  };
}

const JS_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Render `name: version` JSON dependency lines (no trailing comma). */
export function renderJsonDependencyLines(deps: Record<string, string>, indent: string): string {
  return Object.entries(deps)
    .map(([name, version]) => `${indent}"${name}": "${version}"`)
    .join(',\n');
}

/** Render module-federation `shared` entries (no trailing comma). */
export function renderSharedEntries(deps: Record<string, string>, indent: string): string {
  return Object.entries(deps)
    .map(([name, version]) => {
      const key = JS_IDENTIFIER.test(name) ? name : `'${name}'`;
      return (
        `${indent}${key}: {\n` +
        `${indent}  singleton: true,\n` +
        `${indent}  requiredVersion: '${version}',\n` +
        `${indent}  eager: true\n` +
        `${indent}}`
      );
    })
    .join(',\n');
}

