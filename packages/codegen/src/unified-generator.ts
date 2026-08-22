/**
 * Unified MFE Codegen Generator
 * Consolidates feature/component and platform/BFF codegen
 * Implements ADR-014, REQ-REMOTE-003, ADR-027
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import ejs from 'ejs';
import type { DSLManifest, CapabilityConfig, DSLInput, DSLOutput } from '@seans-mfe/dsl';
import { PLATFORM_CAPABILITIES, PLATFORM_CAPABILITY_SPECS, ValidationError } from '@seans-mfe/contracts';
import { toDeclaredSlotIdUnion } from './slot-types';
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
import {
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
import {
  resolveDesignSystemDeps,
  resolveRuntimeExtraDeps,
  resolveClientDependencies,
  resolveNeededMeshPluginsAndTransforms,
  resolveReactSharedDeps,
  renderJsonDependencyLines,
  renderSharedEntries,
} from './dependencies';

export * from './render-model';
export * from './template-io';
import { extractManifestVars, parseHandlerSource } from './render-model';
import type { RenderCapability, RenderLifecycleHook, RenderHandlerSource } from './render-model';
import { renderTemplate, capabilityImplemented, writeGeneratedFiles } from './template-io';




/**
 * The resolved codegen variant a caller injects (ADR-061). The CLI derives it
 * from the framework plugin (loadFrameworkPlugin) so third-party frameworks
 * work; the generator itself never loads a plugin. When no variant is injected
 * the generator falls back to `deriveBuiltinVariant` — the two built-in trios,
 * computed purely from the manifest with no framework-loader dependency.
 */
export interface FrameworkVariant {
  framework: 'react' | 'angular' | string;
  bundler: 'rspack' | 'webpack' | string;
  templateVariant: 'react-rspack' | 'angular-webpack';
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
  validateManifestConfiguration(manifest);

  // Variant is injected by the CLI (ADR-061); default to the built-in trio.
  const variant = options.frameworkVariant ?? deriveBuiltinVariant(manifest);
  const model = planRenderModel(manifest, variant);
  return renderFiles(manifest, basePath, model);
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
 * Render phase — turn the planned model into the concrete GeneratedFile[] set
 * (features, platform, BFF, root/config, entry, and public assets). This is
 * where the framework/bundler variant, the presence of a `data:` section, and
 * external handler sources fan out into template renders.
 */
async function renderFiles(
  manifest: DSLManifest,
  basePath: string,
  model: RenderModel
): Promise<GenerateAllFilesResult> {
  const { vars, handlerSources } = model;
  const files: GeneratedFile[] = [];

  // Codegen template variant selection (computed in extractManifestVars).
  // Manifest.framework + manifest.bundler pick the directory and per-file
  // extensions. Omitted ⇒ React + rspack (back-compat with all existing MFEs).
  const templateVariant = vars.templateVariant;

  // Standardized template directory
  const templateDir = path.resolve(
    __dirname,
    templateVariant === 'angular-webpack'
      ? '../templates/base-mfe-angular'
      : '../templates/base-mfe'
  );
  const featureTplDir = path.join(templateDir, 'features');
  const featuresDir = path.join(basePath, 'src', 'features');
  // Platform/BFF directories and template paths
  const platformDir = path.join(basePath, 'src', 'platform', 'base-mfe');
  const bffDir = path.join(basePath, 'src', 'platform', 'bff');
  const bffTemplateDir = path.resolve(__dirname, '../../../packages/bff-plugin/templates');

  // --- Feature/component generation ---
  // For each domain capability, generate feature, index, test
  const domainCapabilities: string[] = [];
  // Capabilities already realized in code — their stubs are not re-emitted so
  // user implementations survive a re-run (no --force footgun for features).
  const preservedCapabilities: string[] = [];
  // Ensure capabilities array exists and is iterable
  const capabilitiesArray = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];

  for (const entry of capabilitiesArray) {
    // Skip empty/null entries from YAML parsing issues
    if (!entry || typeof entry !== 'object') continue;

    for (const [name, config] of Object.entries(entry)) {
      // Validate entry has valid name and config
      if (!name || !name.trim()) continue;
      if (!config || typeof config !== 'object') continue;
      if (config.type !== 'domain') continue;

      domainCapabilities.push(name);
      const featurePath = path.join(featuresDir, name);
      const featureSpec =
        templateVariant === 'angular-webpack'
          ? {
              componentFile: `${name}.component.ts`,
              componentTpl: 'feature.component.ts.ejs',
              specFile: `${name}.component.spec.ts`,
              specTpl: 'feature.component.spec.ts.ejs',
            }
          : {
              componentFile: `${name}.tsx`,
              componentTpl: 'feature.tsx.ejs',
              specFile: `${name}.test.tsx`,
              specTpl: 'feature.test.tsx.ejs',
            };

      // If the capability is already implemented in its feature file, leave it
      // (and its index/test) untouched — even under --force, since this is user
      // code, not regenerable scaffolding.
      if (await capabilityImplemented(path.join(featurePath, featureSpec.componentFile), name, templateVariant)) {
        preservedCapabilities.push(name);
        continue;
      }

      // Feature component
      files.push({
        path: path.join(featurePath, featureSpec.componentFile),
        content: await renderTemplate(path.join(featureTplDir, featureSpec.componentTpl), {
          name,
          description: config.description || `${name} feature component`,
        }),
        overwrite: false,
      });
      // Feature index
      files.push({
        path: path.join(featurePath, 'index.ts'),
        content: await renderTemplate(path.join(featureTplDir, 'index.ts.ejs'), { name }),
        overwrite: false,
      });
      // Feature test
      files.push({
        path: path.join(featurePath, featureSpec.specFile),
        content: await renderTemplate(path.join(featureTplDir, featureSpec.specTpl), { name }),
        overwrite: false,
      });
    }
  }
  if (preservedCapabilities.length > 0) {
    console.log(
      `Preserved (already implemented): ${preservedCapabilities.join(', ')}`,
    );
  }

  // Remote entrypoint exports all domain capabilities
  const remoteEntry =
    templateVariant === 'angular-webpack'
      ? { file: 'remote.ts', tpl: 'remote.ts.ejs' }
      : { file: 'remote.tsx', tpl: 'remote.tsx.ejs' };
  files.push({
    path: path.join(basePath, 'src', remoteEntry.file),
    content: await renderTemplate(path.join(featureTplDir, remoteEntry.tpl), {
      capabilities: domainCapabilities,
    }),
    overwrite: true,
  });

  // --- Platform/BFF generation ---
  // Generate BaseMFE, types, tests, BFF, .meshrc.yaml
  // .meshrc.yaml from manifest.data
  if (manifest.data) {
    const yaml = require('js-yaml');

    // Build base mesh config (sources, serve, etc.)
    // Filter out empty/invalid sources from YAML parsing issues
    const validSources = (manifest.data.sources || []).filter(
      (source) =>
        source && typeof source === 'object' && source.name && source.name.trim() && source.handler
    );

    const meshBaseConfig: Record<string, unknown> = {
      sources: validSources,
      serve: manifest.data.serve || { endpoint: '/graphql', playground: true },
    };

    const meshConfigYaml = yaml.dump(meshBaseConfig, { noRefs: true, lineWidth: -1 });

    files.push({
      path: path.join(basePath, '.meshrc.yaml'),
      content: await renderTemplate(path.join(bffTemplateDir, 'meshrc.yaml.ejs'), {
        ...vars,
        meshConfigYaml,
      }),
      overwrite: true,
    });

    // Context-injection Envelop plugin (ADR-027): emitted to src/platform/bff/
    // alongside bff.ts. .meshrc.yaml references it as ./src/platform/bff/mesh-context.js.
    files.push({
      path: path.join(bffDir, 'mesh-context.js'),
      content: await renderTemplate(path.join(bffTemplateDir, 'mesh-context.js.ejs'), vars),
      overwrite: true,
    });

    // Demo-mode mock switch (ADR-052): composer and developer-owned fixtures
    // live in src/platform/bff/ alongside the BFF connector.
    if (manifest.data.mockSwitch?.enabled) {
      files.push({
        path: path.join(bffDir, 'mock-switch.js'),
        content: await renderTemplate(path.join(bffTemplateDir, 'mock-switch.js.ejs'), vars),
        overwrite: true,
      });
      files.push({
        path: path.join(bffDir, 'mocks.json'),
        content: await renderTemplate(path.join(bffTemplateDir, 'mocks.json.ejs'), vars),
        overwrite: false,
      });
    }
  }

  // BaseMFE class
  files.push({
    path: path.join(platformDir, 'mfe.ts'),
    content: await renderTemplate(path.join(templateDir, 'mfe.ts.ejs'), vars),
    overwrite: true,
  });
  // ADR-040: emit the handler registry only when at least one lifecycle hook
  // declared a `source`. Without sources, the registry file is absent and the
  // generated mfe.ts looks identical to today (back-compat).
  if (handlerSources.length > 0) {
    files.push({
      path: path.join(platformDir, 'handler-registry.ts'),
      content: await renderTemplate(
        path.join(templateDir, 'handler-registry.ts.ejs'),
        vars,
      ),
      overwrite: true,
    });
  }
  // Bootstrap — exports mfe instance + mfeReady for imperative shell rendering
  files.push({
    path: path.join(platformDir, 'bootstrap.ts'),
    content: await renderTemplate(path.join(templateDir, 'bootstrap.ts.ejs'), vars),
    // Regenerated on every codegen run so the inline manifest stays in sync
    // with mfe-manifest.yaml. Bootstrap is glue code (instantiate, call load,
    // log result); customization belongs in mfe.ts overrides, lifecycle
    // hooks, or `deps.*` DI — not in this file.
    overwrite: true,
  });
  // BaseMFE test
  files.push({
    path: path.join(platformDir, 'mfe.test.ts'),
    content: await renderTemplate(path.join(templateDir, 'mfe.test.ts.ejs'), vars),
    overwrite: true,
  });
  // types.ts
  files.push({
    path: path.join(platformDir, 'types.ts'),
    content: await renderTemplate(path.join(templateDir, 'types.ts.ejs'), vars),
    overwrite: true,
  });

  if (manifest.data) {
    // BFF stub files — only when manifest declares a data: section
    files.push({
      path: path.join(bffDir, 'bff.ts'),
      content: await renderTemplate(path.join(bffTemplateDir, 'bff.ts.ejs'), {
        ...vars,
        bffClassName: vars.className + 'BFF',
      }),
      overwrite: true,
    });
    files.push({
      path: path.join(bffDir, 'bff.test.ts'),
      content: await renderTemplate(path.join(bffTemplateDir, 'bff.test.ts.ejs'), {
        ...vars,
        bffClassName: vars.className + 'BFF',
      }),
      overwrite: true,
    });

    // BFF main server and root files.
    //
    // Important: `package.json` is intentionally NOT in this list. The MFE root
    // template at `packages/codegen/templates/base-mfe/package.json.ejs` is already a
    // hybrid that owns BOTH MFE deps (rspack, react, MUI, etc.) AND BFF deps
    // (mesh, express, helmet, etc.). The BFF template's `package.json.ejs` is a
    // strict subset (no MUI, no MFE-specific scripts) and previously clobbered
    // the hybrid one because it ran first with `overwrite: true`, leaving the
    // generated MFE without MUI deps even though `src/App.tsx` imports them.
    //
    // `server.ts` stays `overwrite: true` because it's pure BFF runtime that the
    // user does not customize. The remaining root files (`tsconfig.json`,
    // `Dockerfile`, `docker-compose.yaml`, `README.md`) flip to `overwrite: false`
    // so user customization survives regeneration, matching the same convention
    // used by other root templates further down (`package.json`, `rspack.config.js`).
    // Angular-webpack emits its own tsconfig.json (with experimentalDecorators,
    // angularCompilerOptions, etc.) in the root templates block below. Skip the
    // BFF tsconfig for that variant so the Angular-specific one wins.
    const bffTemplates: Array<{ tpl: string; out: string; overwrite: boolean }> = [
      { tpl: 'server.ts.ejs', out: 'server.ts', overwrite: true },
      ...(templateVariant !== 'angular-webpack'
        ? [{ tpl: 'tsconfig.json', out: 'tsconfig.json', overwrite: false }]
        : []),
      { tpl: 'Dockerfile.ejs', out: 'Dockerfile', overwrite: false },
      { tpl: 'docker-compose.yaml.ejs', out: 'docker-compose.yaml', overwrite: false },
      { tpl: 'README.md.ejs', out: 'README.md', overwrite: false },
    ];
    // BFF port = MFE port + 1000 (e.g., 3002 → 4002, following e2e2 pattern)
    const mfePort = vars.port || 3000;
    const bffPort = mfePort + 1000;
    const includeStatic = true;
    for (const { tpl, out, overwrite } of bffTemplates) {
      const templatePath = path.join(bffTemplateDir, tpl);
      if (await fs.pathExists(templatePath)) {
        const content = await renderTemplate(templatePath, { ...vars, port: bffPort, includeStatic });
        files.push({
          path: path.join(basePath, out),
          content,
          overwrite,
        });
      }
    }
  }

  // --- Root/config files ---
  // Variant-aware: angular-webpack emits webpack.config.js + tsconfig pair;
  // react-rspack keeps the existing package.json + rspack.config.js shape.
  // tsconfig.json is only emitted here for non-BFF React MFEs — when a BFF
  // is present the BFF plugin already owns it (packages/bff-plugin/templates/tsconfig.json).
  //
  // Ownership is per-entry. These are developer-owned by default — seeded once
  // and never touched again — because an MFE author edits `package.json`,
  // the bundler config and the tsconfigs as a matter of course.
  //
  // The two ignore files are the exception (#341): every line of them names a
  // build artifact the *platform* produces (`.mesh/`, `dist/`, `out-tsc/`, the
  // compiled `server.js` — #274), so the platform is the thing that knows when
  // that list changes. Owning them also brings them under `check:mfe-drift`,
  // which only compares generator-owned files — until now whether an MFE had a
  // `.gitignore` at all depended on whether anyone had run `remote:generate`
  // in it (7 of 8 meridian, 0 of 13 abc-kids).
  //
  // `.dockerignore` was worse: emitted by nothing, hand-maintained in four
  // divergent shapes, and absent from exactly one MFE — which is the one whose
  // image build failed, on `COPY . .` trying to replace the staged runtime
  // directory with the host's node_modules symlink. A file every MFE needs and
  // nothing generates will eventually be missing from one of them.
  //
  // The accepted cost: regeneration now overwrites it, so a customised
  // `.gitignore` outside this repo loses its edits. ADR-082 cannot warn about
  // that — its registry is scoped to developer-owned files, and this one is no
  // longer among them.
  const rootTemplates: Array<{ name: string; ejs: string; overwrite?: boolean }> =
    templateVariant === 'angular-webpack'
      ? [
          { name: 'package.json', ejs: 'package.json.ejs' },
          { name: 'angular.json', ejs: 'angular.json.ejs' },
          { name: 'webpack.config.js', ejs: 'webpack.config.js.ejs' },
          { name: 'tsconfig.json', ejs: 'tsconfig.json.ejs' },
          { name: 'tsconfig.app.json', ejs: 'tsconfig.app.json.ejs' },
          { name: 'tsconfig.spec.json', ejs: 'tsconfig.spec.json.ejs' },
          { name: 'jest.config.js', ejs: 'jest.config.js.ejs' },
          { name: 'setup.jest.ts', ejs: 'setup.jest.ts.ejs' },
          { name: '.gitignore', ejs: '.gitignore.ejs', overwrite: true },
          { name: '.dockerignore', ejs: '.dockerignore.ejs', overwrite: true },
        ]
      : [
          { name: 'package.json', ejs: 'package.json.ejs' },
          { name: 'rspack.config.js', ejs: 'rspack.config.js.ejs' },
          ...(!vars.hasBff ? [{ name: 'tsconfig.json', ejs: 'tsconfig.json.ejs' }] : []),
          { name: '.gitignore', ejs: '.gitignore.ejs', overwrite: true },
          { name: '.dockerignore', ejs: '.dockerignore.ejs', overwrite: true },
        ];
  for (const tpl of rootTemplates) {
    const templatePath = path.join(templateDir, tpl.ejs);
    if (await fs.pathExists(templatePath)) {
      const renderedContent = await renderTemplate(templatePath, vars);
      files.push({
        path: path.join(basePath, tpl.name),
        content: renderedContent,
        // Default user-owned: generated on first init, never on regenerate.
        // See the ownership note on `rootTemplates` for the one exception.
        overwrite: tpl.overwrite ?? false,
      });
    } else {
      // Diagnostic: warn if template missing
      console.warn(
        `[unified-generator] WARNING: Missing template for ${tpl.name}: ${templatePath}`
      );
    }
  }

  // --- Entry files ---
  // Variant-aware. React: src/App.tsx + src/index.tsx (standalone dev shell).
  // Angular: src/main.ts + src/bootstrap.ts + src/polyfills.ts + src/app/app.component.ts.
  if (templateVariant === 'angular-webpack') {
    const angularEntries: Array<{ tpl: string; out: string; overwrite: boolean }> = [
      { tpl: 'src/main.ts.ejs', out: 'src/main.ts', overwrite: false },
      { tpl: 'src/bootstrap.ts.ejs', out: 'src/bootstrap.ts', overwrite: false },
      { tpl: 'src/app/app.component.ts.ejs', out: 'src/app/app.component.ts', overwrite: false },
    ];
    for (const { tpl, out, overwrite } of angularEntries) {
      const templatePath = path.join(templateDir, tpl);
      if (await fs.pathExists(templatePath)) {
        const content = await renderTemplate(templatePath, vars);
        files.push({
          path: path.join(basePath, out),
          content,
          overwrite,
        });
      } else {
        console.warn(`[unified-generator] WARNING: Missing template for ${out}: ${templatePath}`);
      }
    }
  } else {
    // Generate src/App.tsx from EJS template
    const appTemplatePath = path.join(templateDir, 'App.tsx.ejs');
    const appOutPath = path.join(basePath, 'src', 'App.tsx');
    if (await fs.pathExists(appTemplatePath)) {
      const appContent = await renderTemplate(appTemplatePath, vars);
      files.push({
        path: appOutPath,
        content: appContent,
        overwrite: false, // user-owned: App.tsx is the game entry point, not regenerated
      });
    } else {
      // Diagnostic: warn if App.tsx template missing
      console.warn(`[unified-generator] WARNING: Missing template for App.tsx: ${appTemplatePath}`);
    }

    // Generate src/index.tsx (standalone entry point with React bootstrap)
    const indexTemplatePath = path.join(templateDir, 'index.tsx.ejs');
    const indexOutPath = path.join(basePath, 'src', 'index.tsx');
    if (await fs.pathExists(indexTemplatePath)) {
      // Build capability metadata for template
      const capabilityMetadata = domainCapabilities.map((name) => {
        // Find the capability config to get icon/displayName. Neither field is
        // part of CapabilityConfigSchema today, so this reads through an
        // unknown-narrowed view rather than asserting a shape the schema
        // doesn't declare; both fall through to the defaults below in practice.
        const capEntry = manifest.capabilities.find((c) => Object.keys(c).includes(name));
        const capConfig = capEntry?.[name] as unknown as Record<string, unknown> | undefined;
        return {
          className: name,
          displayName: (capConfig?.displayName as string | undefined) || name,
          icon: (capConfig?.icon as string | undefined) || '📦',
        };
      });

      const indexContent = await renderTemplate(indexTemplatePath, {
        ...vars,
        capabilities: capabilityMetadata,
      });
      files.push({
        path: indexOutPath,
        content: indexContent,
        overwrite: false, // user-owned: standalone dev entry, not regenerated
      });
    } else {
      // Diagnostic: warn if index.tsx template missing
      console.warn(
        `[unified-generator] WARNING: Missing template for index.tsx: ${indexTemplatePath}`
      );
    }
  }

  // Slot contract (ADR-067): emit the slot sugar from providesSlots — for every
  // framework. Always regenerated (overwrite: true) so the code can never
  // register a slot id the manifest doesn't declare — declaration and behavior
  // share one source. Variant-agnostic (ADR-036): the template VARIANT owns
  // which sugar flavor it ships — the generator probes the variant's templateDir
  // for a slots.*.ejs instead of hardcoding framework names, so a new framework
  // plugin adds slot support by shipping the template, never by editing this
  // generator. (Angular variants ship slots.ts.ejs — a DeclaredSlotDirective;
  // React ships slots.tsx.ejs — a DeclaredSlot component.)
  const providesSlots = (manifest as { providesSlots?: { id: string; description?: string }[] })
    .providesSlots;
  if (providesSlots && providesSlots.length > 0) {
    const slotsTemplateCandidates = ['slots.ts.ejs', 'slots.tsx.ejs'];
    let slotsEmitted = false;
    for (const candidate of slotsTemplateCandidates) {
      const slotsTemplatePath = path.join(templateDir, candidate);
      if (await fs.pathExists(slotsTemplatePath)) {
        files.push({
          path: path.join(basePath, 'src', candidate.replace(/\.ejs$/, '')),
          content: await renderTemplate(slotsTemplatePath, {
            ...vars,
            providesSlots,
            // ADR-072: the ids are emitted as a type, not only as data, so a
            // manifest rename is a compile error at every use site.
            declaredSlotIdUnion: toDeclaredSlotIdUnion(providesSlots),
          }),
          overwrite: true,
        });
        slotsEmitted = true;
        break;
      }
    }
    if (!slotsEmitted) {
      console.warn(
        `[unified-generator] WARNING: manifest declares providesSlots but template variant ` +
          `"${templateVariant}" ships no slots template (looked for ${slotsTemplateCandidates.join(', ')} in ${templateDir})`
      );
    }
  }

  // --- Public assets ---
  // Generate public/index.html and favicon.ico from EJS templates
  const publicDir = path.join(basePath, 'public');
  const indexHtmlTemplatePath = path.join(templateDir, 'public', 'index.html.ejs');
  const faviconTemplatePath = path.join(templateDir, 'public', 'favicon.ico.ejs');
  if (await fs.pathExists(indexHtmlTemplatePath)) {
    const indexHtmlContent = await renderTemplate(indexHtmlTemplatePath, vars);
    files.push({
      path: path.join(publicDir, 'index.html'),
      content: indexHtmlContent,
      overwrite: true,
    });
  } else {
    console.warn(
      `[unified-generator] WARNING: Missing template for public/index.html: ${indexHtmlTemplatePath}`
    );
  }

  // Generate public/demo.html (runtime demonstration page) — optional, see
  // OPTIONAL_PUBLIC_ASSETS.
  const demoHtmlTemplatePath = path.join(templateDir, 'public', 'demo.html.ejs');
  if (await fs.pathExists(demoHtmlTemplatePath)) {
    const demoHtmlContent = await renderTemplate(demoHtmlTemplatePath, {
      ...vars,
      capabilities: domainCapabilities,
    });
    files.push({
      path: path.join(publicDir, 'demo.html'),
      content: demoHtmlContent,
      overwrite: true,
    });
  }

  if (await fs.pathExists(faviconTemplatePath)) {
    const faviconContent = await renderTemplate(faviconTemplatePath, vars);
    files.push({
      path: path.join(publicDir, 'favicon.ico'),
      content: faviconContent,
      overwrite: true,
    });
  }

  // Jest static-asset mock — required by the moduleNameMapper in the generated jest config
  files.push({
    path: path.join(basePath, '__mocks__', 'fileMock.js'),
    content: 'module.exports = "test-file-stub";\n',
    overwrite: false,
  });

  return { files, preservedCapabilities };
}
