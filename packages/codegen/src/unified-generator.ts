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
import type { DSLManifest } from '@seans-mfe/dsl';
import { PLATFORM_CAPABILITIES, PLATFORM_CAPABILITY_SPECS, ValidationError } from '@seans-mfe/contracts';
// Constant data moved to ./catalog (ADR-050 DEPENDENCY_VERSIONS, ADR-027 Mesh
// tables, #341 optional assets). Re-exported here so the module's public
// surface — and `export * from './unified-generator'` in the barrel — is
// unchanged by the move.
export {
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
import {
  resolveFilePlan,
  mergeTemplateRoots,
  type FileSpec,
  type GeneratorDiagnostic,
} from './file-plan';
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
   * half of why a third framework required editing this file (ADR-093).
   */
  templateVariant: string;
}

/**
 * The web build's framework and bundler, from whichever spelling declared them.
 *
 * Two spellings reach the same pair (ADR-095 §6):
 *
 *     framework: react            targets:
 *     bundler: rspack        ≡      web: { framework: react, bundler: rspack }
 *
 * `targets.web` wins where both are present and agree; where they DISAGREE the
 * manifest is rejected by `validateFull` rather than silently resolved here —
 * two sources of one fact quietly picking a winner is the defect class this
 * repo keeps paying for.
 *
 * This is the single resolution rule (ADR-092 §4). Callers that need the name
 * must not re-derive it: `deriveBuiltinVariant` maps it onto one of the two
 * built-in trios, while the CLI's `resolveFrameworkVariant` hands it to
 * `loadFrameworkPlugin`, where an unrecognised name is a third-party plugin to
 * require (ADR-036), not a value to fall back from. A caller that
 * single-sources the *trio* instead of the *name* silently turns every
 * third-party framework into React.
 */
export function resolveWebTarget(manifest: DSLManifest): { framework: string; bundler: string } {
  const web = manifest.targets?.web;
  const framework = web?.framework ?? manifest.framework;
  const bundler = web?.bundler ?? manifest.bundler;
  // Back-compat rule, unchanged: an explicit framework wins; otherwise
  // `bundler: webpack` is what selects Angular.
  const resolvedFramework = framework ?? (bundler === 'webpack' ? 'angular' : 'react');
  const resolvedBundler = bundler ?? (resolvedFramework === 'angular' ? 'webpack' : 'rspack');
  return { framework: resolvedFramework, bundler: resolvedBundler };
}

/** The framework name a manifest asks for, before any plugin is consulted. */
export function resolveFrameworkName(manifest: DSLManifest): string {
  return resolveWebTarget(manifest).framework;
}

/** The bundler a manifest asks for, by the same rule. */
export function resolveBundlerName(manifest: DSLManifest): string {
  return resolveWebTarget(manifest).bundler;
}

/**
 * Built-in variant fallback: reproduces exactly what loadFrameworkPlugin()
 * returns for the two shipped plugins (react-rspack, angular-webpack), using
 * the same resolution rule (explicit `framework`, else `bundler:'webpack'`
 * selects Angular). Keeps the generator independently runnable/testable
 * without importing the framework loader (ADR-036, ADR-061).
 */
export function deriveBuiltinVariant(manifest: DSLManifest): FrameworkVariant {
  // Reads the author's name, then answers a narrower question: which BUILT-IN
  // trio. Collapsing everything non-Angular to React is correct HERE — there
  // are two built-ins and this is the no-plugin fallback — and wrong anywhere
  // that still has to honour the name the author wrote. That is why the name
  // rule is `resolveFrameworkName` and only the trio is decided below.
  return resolveFrameworkName(manifest) === 'angular'
    ? { framework: 'angular', bundler: 'webpack', templateVariant: 'angular-webpack' }
    : { framework: 'react', bundler: 'rspack', templateVariant: 'react-rspack' };
}

export interface GeneratedFile {
  path: string;
  content: string;
  overwrite: boolean;
}

/** Lifecycle phases, in the order the generated code runs them. */
const LIFECYCLE_PHASES = ['before', 'main', 'after', 'error'] as const;

/** Widened once: `PLATFORM_CAPABILITIES` is a readonly tuple of literals. */
const PLATFORM_CAPABILITY_NAMES: readonly string[] = PLATFORM_CAPABILITIES;

/** The `lifecycle` block of one capability config, as the walk below reads it. */
type CapabilityLifecycle = NonNullable<
  DSLManifest['capabilities'][number][string]['lifecycle']
>;

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
   * Everything the generator has to say about this run (ADR-094). Returned,
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
 * The lifecycle hooks one capability declares, split into stubs and imports.
 *
 * Pulled out of `planRenderModel`, where it sat seven levels deep inside two
 * other loops and the reader had to hold "which capability" and "which phase"
 * in their head to follow a hook's fate. The dedup set is a parameter because
 * dedup is across the WHOLE manifest, not within one capability — the one fact
 * about this walk that is easy to get wrong and impossible to see when it is
 * inlined.
 *
 * ADR-040: a hook declaring a resolvable `source` is wired through the
 * generated handler-registry and gets no stub; anything else gets a stub.
 */
function collectLifecycleHooks(
  lifecycle: CapabilityLifecycle | undefined,
  seen: Set<string>,
): { hooks: RenderLifecycleHook[]; sources: RenderHandlerSource[] } {
  const hooks: RenderLifecycleHook[] = [];
  const sources: RenderHandlerSource[] = [];
  if (!lifecycle) return { hooks, sources };

  for (const phase of LIFECYCLE_PHASES) {
    for (const hookEntry of lifecycle[phase] ?? []) {
      for (const [hookName, hookConfig] of Object.entries(hookEntry)) {
        // A hook may not shadow a platform capability, and the first
        // declaration of a name wins across the whole manifest.
        if (PLATFORM_CAPABILITY_NAMES.includes(hookName)) continue;
        if (seen.has(hookName)) continue;
        seen.add(hookName);

        const source = hookConfig?.source;
        if (typeof source === 'string' && source.length > 0) {
          const parsed = parseHandlerSource(source, hookName);
          if (parsed) {
            sources.push({ localName: hookName, ...parsed });
            continue;
          }
          // An unparseable source falls through to a stub deliberately: the
          // author asked for an external handler and did not get one, so the
          // generated code must still have somewhere for the logic to live.
        }
        hooks.push({ name: hookName, description: hookConfig?.description || '', phase });
      }
    }
  }

  return { hooks, sources };
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
  //
  // A Map, not an object: the key is a capability name straight out of a
  // manifest, and an object answers for every key on Object.prototype as well
  // as its own. `platformCapabilities['toString']` was the inherited function
  // — truthy, so the platform branch was taken — and `.method` on it was
  // `undefined`, which rendered `async  (context: Context): Promise<>` into
  // mfe.ts: a method with no name, from a manifest that passed Zod.
  // Pinned by `__tests__/prototype-keys.test.ts`.
  const platformCapabilities = new Map<string, { method: string; returnTypeBase: string }>(
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
  // NOTE: this loop also used to accumulate `inputs` and `outputs` with
  // `arr = arr.concat(...)` per capability — a fresh copy of the whole array
  // each time — and then never read either one. Templates take inputs and
  // outputs from `capability.config`, not from an aggregate. Removed.

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
      const platformCapability = platformCapabilities.get(method);

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
      const collected = collectLifecycleHooks(safeConfig.lifecycle, lifecycleHookNames);
      lifecycleHooks.push(...collected.hooks);
      handlerSources.push(...collected.sources);
    }
  }

  vars.capabilities = capabilities;
  vars.lifecycleHooks = lifecycleHooks;
  vars.handlerSources = handlerSources;

  return { vars, handlerSources };
}

/**
 * Render phase — turn the planned model into concrete GeneratedFiles by
 * running the variant's file plan (ADR-093).
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

  // A variant id with no registration is a real failure, not a default. The
  // CLI resolves the id from a framework plugin, so reaching here unmatched
  // means the plugin shipped a `templateVariant` it never registered — and
  // falling through to React silently produced a complete, working, wrong MFE.
  // That is the same defect `resolveFrameworkVariant` was fixed for, one layer
  // later, so it gets the same answer: say so.
  const resolved = findVariant(vars.templateVariant);
  const variant = resolved ?? reactRspack;
  const variantDiagnostics: GeneratorDiagnostic[] = resolved
    ? []
    : [
        {
          severity: 'error',
          code: 'unregistered-variant',
          target: vars.templateVariant,
          message:
            `no codegen variant is registered as "${vars.templateVariant}"; ` +
            `generated with "${reactRspack.id}" instead`,
          fix:
            `Call registerVariant() with a CodegenVariant whose id is ` +
            `"${vars.templateVariant}" before generating, or correct the manifest's framework.`,
        },
      ];
  const templateDir = path.resolve(__dirname, '..', 'templates', variant.templateDirName);

  // Whatever registered itself as a contributor (ADR-094 §2). Each brings its
  // own template root, resolved inside its own package, so nothing here names
  // a plugin or reaches outside this package for a template.
  const contributors = fileContributors();
  // Not a spread: `variant` is the root every spec falls back to, and a
  // contributor id is an open string, so spreading let a contributor named
  // `variant` replace the variant's own template directory in silence.
  const { roots, diagnostics: rootDiagnostics } = mergeTemplateRoots(templateDir, contributors);

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
  // of `--force`'s reach as well (ADR-091 §3).
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
  // that preserved anything (ADR-094).

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
    roots,
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

  return {
    files,
    preservedCapabilities,
    diagnostics: [...variantDiagnostics, ...rootDiagnostics, ...diagnostics],
  };
}
