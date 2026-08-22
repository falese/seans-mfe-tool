/**
 * The plan phase's model — the manifest turned into the context templates read.
 *
 * `extractManifestVars` is the whole of it: one manifest in, one flat bag of
 * template variables out. Pure, so it can be reasoned about and tested without
 * a filesystem.
 *
 * `parseHandlerSource` (ADR-040) lives here because a manifest-declared handler
 * source is model data too — it decides what the generated handler-registry
 * imports.
 *
 * Note what this file does NOT do: pick templates or write files. That split is
 * the point. ADR-080 §4 is the rule it serves — EJS cannot import, so the
 * platform capability list is put into the model here rather than re-listed in
 * each template, and a template containing a capability-name array is a defect.
 */

import type { DSLManifest, CapabilityConfig, DSLInput, DSLOutput } from '@seans-mfe/dsl';
import { PLATFORM_CAPABILITIES, PLATFORM_CAPABILITY_SPECS } from '@seans-mfe/contracts';
import { toDeclaredSlotIdUnion } from './slot-types';
import { deriveBuiltinVariant } from './unified-generator';
import type { FrameworkVariant } from './unified-generator';
import {
  DEPENDENCY_VERSIONS,
  DEFAULT_MESH_PLUGINS,
  DEFAULT_MESH_TRANSFORMS,
} from './catalog';
import {
  resolveDesignSystemDeps,
  resolveRuntimeExtraDeps,
  resolveClientDependencies,
  resolveNeededMeshPluginsAndTransforms,
  resolveReactSharedDeps,
  renderJsonDependencyLines,
  renderSharedEntries,
} from './dependencies';

/**
 * The BFF endpoint the generated client connector dials. An MFE with a
 * `data:` section is a single deployable unit: server.ts serves the
 * remoteEntry AND /graphql from the manifest's `endpoint` origin, so the
 * connector bakes the absolute URL (endpoint + data.serve.endpoint).
 * Without a manifest endpoint the relative serve path is all we have.
 */
function resolveBffEndpoint(manifest: DSLManifest): string {
  const servePath = manifest.data?.serve?.endpoint ?? '/graphql';
  const origin = manifest.endpoint;
  if (!origin) return servePath;
  try {
    return new URL(servePath, origin).toString();
  } catch {
    return servePath;
  }
}


/**
 * Extract manifest variables for template rendering
 */
/** One capability row in the render model. */
export interface RenderCapability {
  method: string;
  config: CapabilityConfig;
  returnTypeBase: string;
  stubBody: string;
}

/** One lifecycle hook stub in the render model. */
export interface RenderLifecycleHook {
  name: string;
  description: string;
  phase: string;
}

/** One manifest-declared handler import (ADR-040). */
export interface RenderHandlerSource {
  localName: string;
  module: string;
  exportName: string;
}

export function extractManifestVars(
  manifest: DSLManifest,
  variant: FrameworkVariant = deriveBuiltinVariant(manifest)
) {
  const className = manifest.name.replace(/[^a-zA-Z0-9]/g, '') + 'MFE';
  const inputTypeName = className + 'Inputs';
  const outputTypeName = className + 'Outputs';
  const port = manifest.endpoint ? Number(manifest.endpoint.split(':').pop()) : 3001;
  const muiVersion =
    manifest.dependencies?.['design-system']?.['@mui/material'] || DEPENDENCY_VERSIONS.mui.material;

  // Filter out empty/invalid remote entries from YAML parsing issues. Schema
  // types mfes as Record<string, string>, but this defends against
  // pre-Zod-parse YAML where an entry can still be an object.
  const rawRemotes = (manifest.dependencies?.mfes ?? {}) as unknown as Record<string, unknown>;
  const remotes: Record<string, unknown> = {};
  for (const [name, config] of Object.entries(rawRemotes)) {
    if (name && name.trim() && config && typeof config === 'object') {
      remotes[name] = config;
    }
  }

  // Extract performance/observability config from manifest (ADR-027)
  const performanceConfig = manifest.performance || {};
  const observabilityConfig = performanceConfig.observability || {};

  // Which plugins/transforms are needed — single-sourced with
  // `resolveBffDependencies` so the two can't drift (see that function's doc).
  const { neededPlugins, neededTransforms } = resolveNeededMeshPluginsAndTransforms(manifest);
  // Demo-mode mock switch (ADR-052) is implemented as a resolversComposition transform.
  const mockSwitchEnabled = !!manifest.data?.mockSwitch?.enabled;

  // Variant selection is injected by the caller (ADR-061). The CLI resolves it
  // via the framework plugin (ADR-036, #176) so third-party frameworks work;
  // the default is the built-in trio derived purely from the manifest.
  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    port,
    muiVersion,
    remotes,
    className,
    inputTypeName,
    outputTypeName,
    manifest,
    // Typed rather than bare `[]`: under strict these infer as never[], and
    // planRenderModel then cannot assign the real values back into them.
    capabilities: [] as RenderCapability[], // will be overwritten in generateAllFiles
    lifecycleHooks: [] as RenderLifecycleHook[], // will be overwritten in generateAllFiles
    handlerSources: [] as RenderHandlerSource[], // ADR-040 — overwritten in generateAllFiles

    // Codegen variant selection — injected (ADR-061), read back by generateAllFiles.
    framework: variant.framework as 'react' | 'angular',
    bundler: variant.bundler as 'rspack' | 'webpack',
    templateVariant: variant.templateVariant,

    // NEW: Dependency versions for templates (ADR-027)
    dependencyVersions: DEPENDENCY_VERSIONS,

    // Manifest-driven client dependencies + federation shared (#294). Preformatted
    // here (not in EJS) so ordering/formatting is deterministic for the
    // generate-and-diff drift gate (#295).
    clientDependencyLines: renderJsonDependencyLines(
      resolveClientDependencies(manifest, variant.framework),
      '    '
    ),
    rspackSharedEntries: renderSharedEntries(resolveReactSharedDeps(manifest), '        '),
    angularExtraDependencyLines: (() => {
      if (variant.framework !== 'angular') return '';
      const extras = {
        ...resolveDesignSystemDeps(manifest, 'angular'),
        ...resolveRuntimeExtraDeps(manifest, 'angular'),
      };
      const lines = renderJsonDependencyLines(extras, '    ');
      return lines ? ',\n' + lines : '';
    })(),

    // NEW: Track which plugins/transforms are needed (ADR-027)
    neededPlugins,
    neededTransforms,

    // NEW: Plugin/transform configs (ADR-027)
    meshPlugins: {
      responseCache:
        performanceConfig.caching?.enabled !== false ? DEFAULT_MESH_PLUGINS.responseCache : null,
      prometheus:
        observabilityConfig.prometheus?.enabled !== false
          ? {
              ...DEFAULT_MESH_PLUGINS.prometheus,
              ...observabilityConfig.prometheus,
            }
          : null,
      opentelemetry: observabilityConfig.opentelemetry?.enabled
        ? {
            ...DEFAULT_MESH_PLUGINS.opentelemetry,
            ...observabilityConfig.opentelemetry,
          }
        : null,
    },

    meshTransforms: {
      namingConvention: DEFAULT_MESH_TRANSFORMS.namingConvention,
      rateLimit: performanceConfig.rateLimit?.enabled ? performanceConfig.rateLimit : null,
      filterSchema: performanceConfig.filterSchema?.enabled ? performanceConfig.filterSchema : null,
      // Demo-mode mock switch (ADR-052) — emits a resolversComposition over Query.*
      mockSwitch: mockSwitchEnabled,
      customTransforms: manifest.transforms || [],
    },

    // BFF endpoint for the client-side connector template (bff.ts.ejs).
    // The MFE and its BFF are ONE deployable unit served from the manifest's
    // endpoint origin (server.ts hosts remoteEntry.js and /graphql together),
    // so the connector must carry the absolute URL: a relative path would
    // resolve against the SHELL's origin once the MFE is composed remotely.
    bffEndpoint: resolveBffEndpoint(manifest),

    // True when the manifest declares a data: section — gates doQuery() generation
    // and the bff.ts / server.ts / .meshrc.yaml artifacts in both mfe.ts.ejs templates
    hasBff: !!manifest.data,

    // The ten platform capability names, from the canonical definition in
    // @seans-mfe/contracts (ADR-080). Templates classify a manifest capability
    // as platform vs domain against this instead of an inline literal array —
    // four such arrays existed and two of them were a capability short.
    platformCapabilityNames: [...PLATFORM_CAPABILITIES],
  };
}

// =============================
// Handler source parsing (ADR-040)
// =============================

/**
 * Parse a DSL `source:` specifier into a static import descriptor.
 *
 * Grammar: *   "./rel/path"               → named import `{ <hookName> } from './rel/path'`
 *   "@org/pkg"                 → default import `<hookName> from '@org/pkg'`
 *   "@org/pkg#namedExport"     → named import `{ namedExport as <hookName> } from '@org/pkg'`
 *
 * Returning `null` means the source is malformed (empty / only whitespace);
 * the caller logs and falls back to stub generation so codegen never crashes
 * on a typo.
 */
export function parseHandlerSource(
  source: string,
  hookName: string,
): { module: string; exportName: string } | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx >= 0) {
    const module = trimmed.slice(0, hashIdx).trim();
    const exportName = trimmed.slice(hashIdx + 1).trim();
    if (!module || !exportName) return null;
    return { module, exportName };
  }
  // No '#': relative paths use a named import matching the hook name (the
  // common case for project-local handler files); bare module specifiers use
  // the default export.
  const isRelative = trimmed.startsWith('./') || trimmed.startsWith('../');
  return {
    module: trimmed,
    exportName: isRelative ? hookName : 'default',
  };
}
