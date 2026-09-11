/**
 * The generation pipeline: validate -> plan -> render -> emit.
 *
 * `generateAllFiles` is the whole story. Validate the manifest (ADR-027), plan
 * a RenderModel from it, render that model into GeneratedFiles, and hand them
 * to `writeGeneratedFiles` to emit. The phases are separated so each can be
 * reasoned about alone: plan is pure, render picks templates, only emit touches
 * disk.
 *
 * WHY THE `overwrite` FLAG ON EVERY GeneratedFile IS THE MOST IMPORTANT LINE
 * IN THIS PACKAGE: it decides ownership. `overwrite: true` files are
 * generator-owned — regenerated on every run, held byte-identical by
 * `check:mfe-drift`. `overwrite: false` files are seeded once and then belong
 * to the developer, and are never rewritten, not even with `--force`.
 *
 * Moving a file between those two settings is the most breaking edit available
 * here, and it is invisible in a diff. It is also why a platform change that
 * reaches developer-owned code ships with a PLATFORM_MIGRATIONS entry in the
 * same commit (ADR-082): the platform reports what it cannot fix. The measured
 * cost of not doing that was 48 files needing a change, regeneration reaching
 * 29, and the other 19 sitting stale with every gate green.
 *
 * Framework differences are template-variant data, never branches in this file
 * (ADR-036, ADR-061) — the variant is injected by the caller, which is what
 * lets a third-party framework plugin work without editing the generator.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import type { DSLManifest, DSLInput, DSLOutput } from '@seans-mfe/dsl';
import { PLATFORM_CAPABILITIES, PLATFORM_CAPABILITY_SPECS, ValidationError } from '@seans-mfe/contracts';
// Constant data moved to ./catalog (ADR-050 DEPENDENCY_VERSIONS, ADR-027 Mesh
// tables, #341 optional assets). Re-exported here so the module's public
// surface — and `export * from './unified-generator'` in the barrel — is
// unchanged by the move.
export {
  OPTIONAL_PUBLIC_ASSETS,
  DEPENDENCY_VERSIONS,
  DEFAULT_MESH_PLUGINS,
  DEFAULT_MESH_TRANSFORMS,
  KNOWN_MESH_PLUGINS,
  KNOWN_MESH_TRANSFORMS,
} from './catalog';
// Extracted to focused modules; re-exported so this module's public surface,
// and the barrel's `export * from './unified-generator'`, are unchanged.
export * from './manifest-validation';
export * from './dependencies';
import { validateManifestConfiguration } from './manifest-validation';

export * from './render-model';
export * from './template-io';
import { extractManifestVars, parseHandlerSource } from './render-model';
import type { RenderCapability, RenderLifecycleHook, RenderHandlerSource } from './render-model';
import { renderTemplate, capabilityImplemented } from './template-io';

export * from './file-plan';
export * from './variants';
export * from './contributors';
import { fileContributors } from './contributors';
import { resolveFilePlan, type FileSpec, type GeneratorDiagnostic } from './file-plan';
import {
  findVariant,
  reactRspack,
  featureSpecs,
  slotSpecs,
  PLATFORM_SPECS,
  PUBLIC_SPECS,
  FILE_MOCK_SPEC,
  type GenPlanContext,
} from './variants';




/**
 * The resolved codegen variant a caller injects (ADR-061). The CLI derives it
 * from the framework plugin (loadFrameworkPlugin) so third-party frameworks
 * work; the generator itself never loads a plugin. When no variant is injected
 * the generator falls back to `deriveBuiltinVariant` — the two built-in trios,
 * computed purely from the manifest with no framework-loader dependency.
 */
export interface FrameworkVariant {
  framework: string;
  bundler: string;
  /**
   * The variant id. Open, not a union of the two built-ins: closing it was
   * half of why a third framework required editing this file (ADR-091).
   */
  templateVariant: string;
}

/**
 * Built-in variant fallback: reproduces exactly what loadFrameworkPlugin()
 * returns for the two shipped plugins (react-rspack, angular-webpack), using
 * the same resolution rule (explicit `framework`, else `bundler:'webpack'`
 * selects Angular). Keeps the generator independently runnable/testable
 * without importing the framework loader (ADR-036, ADR-061).
 */

export function deriveBuiltinVariant(manifest: DSLManifest): FrameworkVariant {
  const framework = manifest.framework ?? (manifest.bundler === 'webpack' ? 'angular' : 'react');
  return framework === 'angular'
    ? { framework: 'angular', bundler: 'webpack', templateVariant: 'angular-webpack' }
    : { framework: 'react', bundler: 'rspack', templateVariant: 'react-rspack' };
}

export interface GeneratedFile {
  path: string;
  content: string;
  overwrite: boolean;
}

// =============================================================================
// Dependency Version Constants (ADR-027)
// =============================================================================


// Unified Generator Entrypoint
// =============================

/**
 * Generate all files (features, platform, BFF, configs) for a manifest
 */
export interface GenerateAllFilesResult {
  files: GeneratedFile[];
  preservedCapabilities: string[];
  /**
   * Everything the generator has to say about this run (ADR-092). Returned,
   * never printed: the caller decides whether that means chalk on a terminal,
   * a field in the JSON envelope, or nothing at all.
   */
  diagnostics: GeneratorDiagnostic[];
}

/**
 * The planned model handed from the plan phase to the render phase.
 *
 * `vars` is the template context (populated with the aggregated capabilities,
 * lifecycle hooks, and handler sources); `handlerSources` is surfaced
 * separately because the render phase gates the handler-registry file on it
 * (ADR-040).
 */
interface RenderModel {
  vars: ReturnType<typeof extractManifestVars>;
  handlerSources: Array<{ localName: string; module: string; exportName: string }>;
}

/**
 * Generate all files (features, platform, BFF, configs) for a manifest.
 *
 * Three phases, each isolated so they can be reasoned about (and reused)
 * independently: validate → plan (aggregate manifest into a RenderModel) →
 * render (turn the model into concrete GeneratedFiles). Emit is a separate
 * step (writeGeneratedFiles).
 */
export async function generateAllFiles(
  manifest: DSLManifest,
  basePath: string,
  options: { force?: boolean; dryRun?: boolean; frameworkVariant?: FrameworkVariant } = {}
): Promise<GenerateAllFilesResult> {
  // === Validation Layer (ADR-027) ===
  // Validate manifest configuration before generation
  // Throws if validation fails (prevents bad configurations)
  const configuration = validateManifestConfiguration(manifest);
  if (!configuration.ok) {
    // Reporting differently is not permitting: ADR-027 refuses to generate
    // from a manifest whose plugins and transforms are misclassified, because
    // the alternative is discovering it at runtime inside a container.
    const errors = configuration.diagnostics.filter((d) => d.severity === 'error');
    throw new ValidationError(
      `Manifest validation failed with ${errors.length} error(s): ` +
        errors.map((d) => d.message).join('; '),
      'data',
      'valid-plugin-transform-config',
    );
  }

  // Variant is injected by the CLI (ADR-061); default to the built-in trio.
  const variant = options.frameworkVariant ?? deriveBuiltinVariant(manifest);
  const model = planRenderModel(manifest, variant);
  const rendered = await renderFiles(manifest, basePath, model);
  return {
    ...rendered,
    diagnostics: [...configuration.diagnostics, ...rendered.diagnostics],
  };
}

/**
 * Plan phase — aggregate the manifest's capabilities, lifecycle hooks, and
 * external handler sources (ADR-040) into the template `vars`. Pure: no disk
 * access, no template rendering.
 */

function planRenderModel(manifest: DSLManifest, variant: FrameworkVariant): RenderModel {
  const vars = extractManifestVars(manifest, variant);
  // --- Platform contract-driven capability and lifecycle aggregation ---
  // Keyed by the PascalCase manifest spelling, derived from the canonical
  // capability set in @seans-mfe/contracts (ADR-080). This map was previously
  // written out by hand and omitted UpdateControlPlaneState, so a manifest
  // declaring it was generated as a domain capability.
  const platformCapabilities: Record<
    string,
    { method: string; returnTypeBase: string } | undefined
  > = Object.fromEntries(
    PLATFORM_CAPABILITIES.map((name) => {
      const spec = PLATFORM_CAPABILITY_SPECS[name];
      return [spec.manifestKey, { method: spec.name, returnTypeBase: spec.resultType }];
    })
  );

  const capabilities: RenderCapability[] = [];
  const lifecycleHookNames = new Set<string>();
  const lifecycleHooks: RenderLifecycleHook[] = [];
  // ADR-040: handlers that declare a `source` in the DSL manifest are sourced
  // from external modules. They appear in handlerSources (drives the generated
  // handler-registry.ts + import wiring) and are excluded from lifecycleHooks
  // (no stub method is emitted because the implementation lives elsewhere).
  const handlerSources: RenderHandlerSource[] = [];
  let inputs: DSLInput[] = [];
  let outputs: DSLOutput[] = [];

  for (const entry of manifest.capabilities) {
    for (const [method, config] of Object.entries(entry)) {
      // Ensure inputs/outputs are always arrays
      const safeConfig = {
        ...config,
        inputs: Array.isArray(config.inputs) ? config.inputs : [],
        outputs: Array.isArray(config.outputs) ? config.outputs : [],
      };
      // `method` comes from Object.entries over manifest data, so it is a bare
      // string. Look it up once and narrow, rather than indexing three times
      // with a key the compiler cannot prove is present.
      const platformCapability = platformCapabilities[method];

      if (platformCapability) {
        capabilities.push({
          method: platformCapability.method,
          config: safeConfig,
          returnTypeBase: platformCapability.returnTypeBase,
          stubBody: '',
        });
      } else {
        capabilities.push({
          method,
          config: safeConfig,
          returnTypeBase: method + 'Outputs',
          stubBody: '',
        });
      }
      // Collect lifecycle hooks from capability config, deduplicated
      // Filter out base capability names to prevent conflicts
      const baseCapabilityNames: readonly string[] = PLATFORM_CAPABILITIES;
      if (safeConfig.lifecycle) {
        for (const phase of ['before', 'main', 'after', 'error'] as const) {
          if (safeConfig.lifecycle[phase]) {
            for (const hookEntry of safeConfig.lifecycle[phase]) {
              for (const [hookName, hookConfig] of Object.entries(hookEntry)) {
                // Skip if it's a base capability name OR already added
                if (!baseCapabilityNames.includes(hookName) && !lifecycleHookNames.has(hookName)) {
                  lifecycleHookNames.add(hookName);
                  const hookDescription = hookConfig?.description || '';
                  // ADR-040: hooks with a `source` are wired through the
                  // generated handler-registry, not emitted as stubs.
                  const source = hookConfig?.source;
                  if (typeof source === 'string' && source.length > 0) {
                    const parsed = parseHandlerSource(source, hookName);
                    if (parsed) {
                      handlerSources.push({ localName: hookName, ...parsed });
                      continue;
                    }
                  }
                  lifecycleHooks.push({ name: hookName, description: hookDescription, phase });
                }
              }
            }
          }
        }
      }
      // Collect inputs/outputs from capability config
      if (safeConfig.inputs) inputs = inputs.concat(safeConfig.inputs);
      if (safeConfig.outputs) outputs = outputs.concat(safeConfig.outputs);
    }
  }

  vars.capabilities = capabilities;
  vars.lifecycleHooks = lifecycleHooks;
  vars.handlerSources = handlerSources;

  return { vars, handlerSources };
}

/**
 * Render phase — turn the planned model into concrete GeneratedFiles by
 * running the variant's file plan (ADR-091).
 *
 * This function used to be ~300 lines with ~25 hand-written `files.push` sites
 * and six comparisons against the string literal `'angular-webpack'`. It now
 * assembles a plan and hands it to `resolveFilePlan`. **There is no framework
 * name in this file.** Adding a framework is a module under `./variants` plus
 * a template directory; the acceptance test for that property lives in
 * `__tests__/third-variant.test.ts`.
 */
async function renderFiles(
  manifest: DSLManifest,
  basePath: string,
  model: RenderModel
): Promise<GenerateAllFilesResult> {
  const { vars, handlerSources } = model;

  const variant = findVariant(vars.templateVariant) ?? reactRspack;
  const templateDir = path.resolve(__dirname, '..', 'templates', variant.templateDirName);

  // Whatever registered itself as a contributor (ADR-092 §2). Each brings its
  // own template root, resolved inside its own package, so nothing here names
  // a plugin or reaches outside this package for a template.
  const contributors = fileContributors();
  const contributorRoots = Object.fromEntries(contributors.map((c) => [c.id, c.templateRoot]));

  // --- Domain capabilities, and which are already realised in code ---
  const domainCapabilities: string[] = [];
  const capabilitiesArray = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
  for (const entry of capabilitiesArray) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [name, config] of Object.entries(entry)) {
      if (!name || !name.trim()) continue;
      if (!config || typeof config !== 'object') continue;
      if (config.type !== 'domain') continue;
      domainCapabilities.push(name);
    }
  }

  const ctx: GenPlanContext = {
    manifest,
    vars: vars as unknown as Record<string, unknown>,
    variant,
    domainCapabilities,
    handlerSources,
    hasBff: !!manifest.data,
  };

  // A capability already implemented keeps its files untouched — not emitted
  // and skipped, but absent from the plan entirely, which is what puts it out
  // of `--force`'s reach as well (ADR-089 §3).
  const preservedCapabilities: string[] = [];
  const featurePlan: FileSpec[] = [];
  for (const name of domainCapabilities) {
    const componentPath = path.join(
      basePath, 'src', 'features', name, variant.featureFiles(name).component,
    );
    if (await capabilityImplemented(componentPath, name, variant.implementedPatterns(name))) {
      preservedCapabilities.push(name);
      continue;
    }
    featurePlan.push(...featureSpecs(ctx, name));
  }
  // Deliberately not printed. `preservedCapabilities` is on the result and the
  // CLI already renders it; printing here produced the line twice on every run
  // that preserved anything (ADR-092).

  const plan: FileSpec[] = [
    ...featurePlan,
    {
      template: variant.remoteEntry.template,
      out: variant.remoteEntry.out,
      owner: 'generator',
      vars: () => ({ capabilities: domainCapabilities }),
    },
    ...PLATFORM_SPECS,
    ...contributors.flatMap((c) => c.specs),
    ...variant.specs,
    ...slotSpecs(ctx),
    ...PUBLIC_SPECS,
    FILE_MOCK_SPEC,
  ];

  const { files, diagnostics } = await resolveFilePlan(plan, {
    basePath,
    roots: { variant: templateDir, ...contributorRoots },
    vars: vars as unknown as Record<string, unknown>,
    ctx,
    io: {
      exists: (p) => fs.pathExists(p),
      render: (p, v) => renderTemplate(p, v),
    },
  });

  if (manifest.providesSlots?.length && !variant.slots) {
    diagnostics.push({
      severity: 'warning',
      code: 'no-slots-template',
      target: 'providesSlots',
      message:
        `manifest declares providesSlots but variant "${variant.id}" ships no slots template`,
      fix: `Add a slots template to the "${variant.id}" variant, or remove providesSlots.`,
    });
  }

  return { files, preservedCapabilities, diagnostics };
}
