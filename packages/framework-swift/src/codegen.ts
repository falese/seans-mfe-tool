/**
 * The Swift native target's contribution to MFE code generation (ADR-095).
 *
 * `remote:generate` emits a Swift Package into an MFE whose manifest declares
 * a `targets.swift` block — a SECOND artifact built from the SAME manifest,
 * beside the Module Federation remote.
 *
 * This is a `FileContributor`, not a `CodegenVariant` and not a
 * `BaseFrameworkPlugin`:
 *
 *   - A `CodegenVariant` is mutually exclusive — `findVariant()` picks exactly
 *     one per MFE — so it cannot express a second build.
 *   - `BaseFrameworkPlugin` has had no codegen surface since ADR-092 removed
 *     the six members nothing called; a framework plugin cannot ship a
 *     template at all.
 *
 * The BFF already proved the contributor seam does exactly this job (ADR-094
 * §2). Swift is the third contributor on it, which is why
 * `unified-generator.ts` is untouched by this feature.
 *
 * Importing this module registers the contribution. `templateRoot` is resolved
 * here, inside the package that owns the templates, so the generator never
 * names this package.
 */

import * as path from 'path';
import {
  registerFileContributor,
  type FileSpec,
  type GeneratedFile,
} from '@seans-mfe/codegen';
import {
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
  MFE_LIFECYCLE_STATES,
  MFE_LIFECYCLE_TRANSITIONS,
} from '@seans-mfe/contracts';

const SWIFT_DIR = 'swift';
/**
 * Fixed on-disk target directory. `FileSpec.out` is a static string, not a
 * function of the model, so the module name cannot appear in a path. SPM's
 * explicit `path:` on a target carries the real name instead — which is why
 * `Package.swift` says `path: "Sources/MFE"`.
 */
const SOURCES = `${SWIFT_DIR}/Sources/MFE`;
const PLATFORM = `${SOURCES}/Platform`;

/** Result type per capability, as a Swift type name. */
const SWIFT_RESULTS: Record<string, string> = {
  void: 'Void',
  boolean: 'Bool',
};

/** The plan context, as much of it as these specs read. */
interface SwiftCtx {
  manifest: {
    name: string;
    version: string;
    owner?: string;
    endpoint?: string;
    capabilities?: unknown;
    targets?: { swift?: SwiftTargetConfig };
  };
  vars: { bffEndpoint?: string };
  domainCapabilities: string[];
  /** True when the manifest declares a `data:` section — i.e. there is a BFF. */
  hasBff: boolean;
}

interface SwiftTargetConfig {
  moduleName?: string;
  bundleId?: string;
  deploymentTarget?: string;
  swiftToolsVersion?: string;
  capabilities?: string[];
}

const swiftTarget = (c: unknown): SwiftTargetConfig | undefined =>
  (c as SwiftCtx).manifest.targets?.swift;

/** Every spec's gate — the direct analogue of the BFF's `hasBff`. */
const hasSwift = (c: unknown): boolean => swiftTarget(c) !== undefined;

/**
 * The Swift target AND a BFF to talk to.
 *
 * A manifest with no `data:` section generates no BFF, so there is nothing for
 * a client to connect to and the provider stays a bare protocol for the host
 * to implement.
 */
const hasSwiftBff = (c: unknown): boolean => hasSwift(c) && (c as SwiftCtx).hasBff;

/** `crew-services` → `CrewServices`. Must be a legal Swift identifier. */
export function pascalCase(name: string): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  // A leading digit is not a legal Swift identifier start.
  return /^[0-9]/.test(joined) ? `MFE${joined}` : joined || 'MFE';
}

/** `CrewRoster` → `crewRoster`, for a Swift method name. */
export function camelCase(name: string): string {
  const p = pascalCase(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** Module name: explicit override, else PascalCase of the MFE name. */
export function moduleNameFor(c: unknown): string {
  const ctx = c as SwiftCtx;
  return swiftTarget(c)?.moduleName || pascalCase(ctx.manifest.name);
}

/** Bundle id: explicit override, else reverse-DNS from owner + name. */
export function bundleIdFor(c: unknown): string {
  const ctx = c as SwiftCtx;
  const explicit = swiftTarget(c)?.bundleId;
  if (explicit) return explicit;
  const owner = (ctx.manifest.owner || 'platform').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  return `com.${owner}.${ctx.manifest.name}`;
}

/** `17.0` → `17`, for `.iOS(.v17)`. */
function deploymentMajor(c: unknown): string {
  const raw = swiftTarget(c)?.deploymentTarget || '17.0';
  return raw.split('.')[0];
}

/**
 * The domain capabilities THIS target implements (ADR-095).
 *
 * `targets.swift.capabilities` names a subset; omitted means all of them, so a
 * manifest written before the field existed keeps its meaning. A name the
 * manifest does not declare is dropped here and reported by `mfe:validate`
 * rather than silently emitting a view for a capability that does not exist.
 */
function selectedCapabilities(c: unknown): string[] {
  const all = (c as SwiftCtx).domainCapabilities;
  const declared = swiftTarget(c)?.capabilities;
  if (!declared) return all;
  return declared.filter((name) => all.includes(name));
}

/** Manifest capability descriptions, keyed by capability name. */
function capabilityDescriptions(c: unknown): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  const caps = (c as SwiftCtx).manifest.capabilities;
  if (!Array.isArray(caps)) return out;
  for (const entry of caps) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [name, config] of Object.entries(entry as Record<string, unknown>)) {
      const cfg = config as { description?: string } | undefined;
      out[name] = cfg?.description ?? '';
    }
  }
  return out;
}

/**
 * The platform contract, shaped for EJS.
 *
 * Read from `@seans-mfe/contracts` rather than restated here — the whole point
 * of ADR-096 is that the Swift rendering cannot drift from the TypeScript
 * contract, and a literal array in this file would be exactly that drift.
 */
function contractVars(): Record<string, unknown> {
  return {
    lifecycleStates: [...MFE_LIFECYCLE_STATES],
    lifecycleTransitions: MFE_LIFECYCLE_STATES.map((from) => ({
      from,
      to: [...(MFE_LIFECYCLE_TRANSITIONS[from] ?? [])],
    })),
    platformCapabilities: PLATFORM_CAPABILITIES.map((name) => {
      const spec = PLATFORM_CAPABILITY_SPECS[name];
      return {
        name,
        pascal: name.charAt(0).toUpperCase() + name.slice(1),
        description: spec.description,
        swiftResult: SWIFT_RESULTS[spec.resultType] ?? spec.resultType,
        preStates: [...spec.preStates],
        enterState: spec.enterState,
        exitState: spec.exitState,
        errorState: spec.errorState,
      };
    }),
  };
}

/** Vars every Swift template gets. */
const swiftVars = (c: unknown): Record<string, unknown> => {
  const ctx = c as SwiftCtx;
  return {
    ...contractVars(),
    moduleName: moduleNameFor(c),
    bundleId: bundleIdFor(c),
    swiftToolsVersion: swiftTarget(c)?.swiftToolsVersion || '5.9',
    deploymentTargetMajor: deploymentMajor(c),
    domainCapabilities: selectedCapabilities(c),
    capabilityDescriptions: capabilityDescriptions(c),
    bffEndpoint: ctx.vars.bffEndpoint,
    hasBff: hasSwiftBff(c),
    manifestHandlers: manifestHandlers(c),
    camel: camelCase,
  };
};

/**
 * The manifest, projected to JSON for the SPM build-tool plugin.
 *
 * JSON rather than YAML because `Foundation.JSONDecoder` needs no dependency,
 * and a build plugin that drags in a YAML parser is one nobody will keep.
 * Generator-owned and committed: it is the Swift lane's `discovery:` analogue.
 */
const manifestProjection = (c: unknown): Record<string, unknown> => {
  const ctx = c as SwiftCtx;
  const descriptions = capabilityDescriptions(c);
  const caps = Array.isArray(ctx.manifest.capabilities) ? ctx.manifest.capabilities : [];
  const selected = new Set(selectedCapabilities(c));
  const projected: Array<{
    name: string;
    type: string;
    description: string;
    lifecycle?: Array<{ phase: string; hook: string; handlers: string[]; contained: boolean }>;
  }> = [];
  for (const entry of caps) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [name, config] of Object.entries(entry as Record<string, unknown>)) {
      const cfg = config as { type?: string } | undefined;
      const isPlatform = cfg?.type === 'platform';
      // A domain capability this target does not implement is not part of its
      // contract, so `describe` must not report it.
      if (!isPlatform && !selected.has(name)) continue;
      const lifecycle = projectLifecycle(config);
      projected.push({
        name,
        type: isPlatform ? 'platform' : 'domain',
        description: descriptions[name] ?? '',
        ...(lifecycle.length > 0 ? { lifecycle } : {}),
      });
    }
  }
  return {
    manifestJson:
      JSON.stringify(
        {
          name: ctx.manifest.name,
          version: ctx.manifest.version,
          bundleId: bundleIdFor(c),
          bffEndpoint: ctx.vars.bffEndpoint ?? null,
          capabilities: projected,
        },
        null,
        2,
      ) + '\n',
  };
};

/**
 * A capability's manifest `lifecycle:` block, flattened for the SPM plugin
 * (ADR-040, ADR-098 §5).
 *
 * The YAML nests phase → [ { hookName: { handler, contained } } ]. A flat list
 * is what the Swift side filters, and flattening here keeps the build-time
 * generator a decoder rather than a parser.
 */
function projectLifecycle(
  config: unknown,
): Array<{ phase: string; hook: string; handlers: string[]; contained: boolean }> {
  const out: Array<{ phase: string; hook: string; handlers: string[]; contained: boolean }> = [];
  const lifecycle = (config as { lifecycle?: Record<string, unknown> } | undefined)?.lifecycle;
  if (!lifecycle || typeof lifecycle !== 'object') return out;

  for (const phase of ['before', 'main', 'after', 'error']) {
    const entries = (lifecycle as Record<string, unknown>)[phase];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      for (const [hook, raw] of Object.entries(entry as Record<string, unknown>)) {
        const cfg = raw as { handler?: unknown; contained?: unknown } | undefined;
        const handler = cfg?.handler;
        // REQ-045: a handler may be a single name or an array, run in order.
        const handlers = Array.isArray(handler)
          ? handler.filter((h): h is string => typeof h === 'string')
          : typeof handler === 'string'
            ? [handler]
            : [];
        if (handlers.length === 0) continue;
        out.push({ phase, hook, handlers, contained: cfg?.contained === true });
      }
    }
  }
  return out;
}

/**
 * Every handler the manifest names, deduplicated, with where it came from.
 *
 * The web lane generates a stub METHOD per hook in `mfe.ts`, so a manifest that
 * declares `handler: onLoadBegin` works the moment it is generated. Swift
 * cannot resolve a handler to a method by name (ADR-098 §3), so the native
 * equivalent is a generated entry in `customHandlers` — without it a generated
 * package would throw on `load()` for a manifest the web lane runs happily.
 */
function manifestHandlers(
  c: unknown,
): Array<{ handler: string; capability: string; phase: string; hook: string }> {
  const seen = new Set<string>();
  const out: Array<{ handler: string; capability: string; phase: string; hook: string }> = [];
  const caps = (c as SwiftCtx).manifest.capabilities;
  if (!Array.isArray(caps)) return out;
  for (const entry of caps) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [capability, config] of Object.entries(entry as Record<string, unknown>)) {
      for (const spec of projectLifecycle(config)) {
        for (const handler of spec.handlers) {
          if (seen.has(handler)) continue;
          seen.add(handler);
          out.push({ handler, capability, phase: spec.phase, hook: spec.hook });
        }
      }
    }
  }
  return out;
}

/**
 * `Platform/` is generator-owned, `Features/` is developer-owned.
 *
 * Not new policy — the existing split restated. `src/platform/**` is
 * generator-owned and `src/features/**` is developer-owned in the web lane, so
 * a Swift author's edits survive regeneration for the same reason a React
 * author's do.
 *
 * `swift/.gitignore` is emitted here rather than appended to the MFE root
 * `.gitignore`: the root file is variant-owned and its ownership is pinned by
 * `gitignore-ownership.test.ts`.
 */
const STATIC_SWIFT_SPECS: FileSpec[] = [
  // Developer-owned scaffolding
  { template: 'Package.swift.ejs', out: `${SWIFT_DIR}/Package.swift`, owner: 'developer', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'README.md.ejs', out: `${SWIFT_DIR}/README.md`, owner: 'developer', root: 'swift', when: hasSwift, vars: swiftVars },


  // Generator-owned: the contract and everything derived from it
  { template: 'gitignore.ejs', out: `${SWIFT_DIR}/.gitignore`, owner: 'generator', root: 'swift', when: hasSwift },
  { template: 'mfe-manifest.json.ejs', out: `${SWIFT_DIR}/mfe-manifest.json`, owner: 'generator', root: 'swift', when: hasSwift, vars: manifestProjection },
  { template: 'Plugins/plugin.swift.ejs', out: `${SWIFT_DIR}/Plugins/ManifestCodegen/plugin.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Gen/main.swift.ejs', out: `${SWIFT_DIR}/Sources/ManifestMetadataGen/main.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Sources/Platform/MFELifecycle.swift.ejs', out: `${PLATFORM}/MFELifecycle.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Sources/Platform/MFEBase.swift.ejs', out: `${PLATFORM}/MFEBase.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Sources/Platform/NativeMFEBase.swift.ejs', out: `${PLATFORM}/NativeMFEBase.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Sources/Platform/GeneratedMFE.swift.ejs', out: `${PLATFORM}/GeneratedMFE.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Sources/Platform/Types.swift.ejs', out: `${PLATFORM}/Types.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Sources/Platform/DataProvider.swift.ejs', out: `${PLATFORM}/DataProvider.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  // The BFF client and the provider that uses it — generator-owned, because
  // the wiring from a capability to a query is mechanical. Emitted only when
  // there is a BFF (ADR-012).
  { template: 'Sources/Platform/BFFClient.swift.ejs', out: `${PLATFORM}/BFFClient.swift`, owner: 'generator', root: 'swift', when: hasSwiftBff, vars: swiftVars },
  { template: 'Sources/Platform/BFFDataProvider.swift.ejs', out: `${PLATFORM}/BFFDataProvider.swift`, owner: 'generator', root: 'swift', when: hasSwiftBff, vars: swiftVars },
  { template: 'Sources/Platform/CapabilityViewRegistry.swift.ejs', out: `${PLATFORM}/CapabilityViewRegistry.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Tests/LifecycleTests.swift.ejs', out: `${SWIFT_DIR}/Tests/MFETests/LifecycleTests.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
];

/**
 * The full plan for a generation: the fixed files, plus one view per capability
 * this target implements.
 *
 * A function rather than an array because `FileSpec.out` is a static string
 * (ADR-095), so per-capability paths cannot be known until a manifest is read.
 * This mirrors the web lane's `featureSpecs(ctx, capability)` — and it is what
 * makes a capability added later land in its OWN new file, which regeneration
 * writes because it does not exist yet, instead of needing a hand-edit to a
 * developer-owned file regeneration will never touch.
 */
export function swiftSpecs(ctx: unknown): FileSpec[] {
  if (!hasSwift(ctx)) return [];
  const descriptions = capabilityDescriptions(ctx);
  return [
    ...STATIC_SWIFT_SPECS,
    ...selectedCapabilities(ctx).flatMap((name) => {
      const perCapability: FileSpec[] = [
        {
          template: 'Sources/Features/CapabilityView.swift.ejs',
          out: `${SOURCES}/Features/${name}View.swift`,
          owner: 'developer',
          root: 'swift',
          // The view fetches through the injected provider, so it needs the
          // module's names as well as its own.
          vars: () => ({ ...swiftVars(ctx), name, description: descriptions[name] ?? '' }),
        },
      ];
      // The document backing this capability. Developer-owned for the same
      // reason the web lane's queries are: the BFF's schema is composed by
      // Mesh from `data.sources` at build time, so codegen cannot know the
      // field names.
      if (hasSwiftBff(ctx)) {
        perCapability.push({
          template: 'Sources/Features/CapabilityQuery.swift.ejs',
          out: `${SOURCES}/Features/${name}Query.swift`,
          owner: 'developer',
          root: 'swift',
          vars: () => ({ name, bffEndpoint: (ctx as SwiftCtx).vars.bffEndpoint ?? '' }),
        });
      }
      return perCapability;
    }),
  ];
}

/** Kept exported under its original name for anything importing the plan. */
export const SWIFT_SPECS = STATIC_SWIFT_SPECS;

/** Absolute, resolved inside this package. From dist/ that is ../templates. */
export const swiftTemplateRoot = path.resolve(__dirname, '..', 'templates');

/**
 * Register the Swift file contribution.
 *
 * An explicit function rather than a module-level side effect, which is what
 * `SwiftSpmPlugin.registerCodegen()` calls (ADR-097). The side-effect form
 * could not satisfy its own idempotence contract: `require()` caches, so once
 * the module had been loaded a second call did nothing — which is fine while
 * nobody ever unregisters, and wrong the moment anything does. A function runs
 * every time it is called, and `registerFileContributor` keys by id, so the
 * result is idempotent for the right reason.
 */
export function registerSwiftCodegen(): void {
  registerFileContributor({ id: 'swift', templateRoot: swiftTemplateRoot, specs: swiftSpecs });
}

export type { GeneratedFile };
