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
}

interface SwiftTargetConfig {
  moduleName?: string;
  bundleId?: string;
  deploymentTarget?: string;
  swiftToolsVersion?: string;
}

const swiftTarget = (c: unknown): SwiftTargetConfig | undefined =>
  (c as SwiftCtx).manifest.targets?.swift;

/** Every spec's gate — the direct analogue of the BFF's `hasBff`. */
const hasSwift = (c: unknown): boolean => swiftTarget(c) !== undefined;

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
    domainCapabilities: ctx.domainCapabilities,
    capabilityDescriptions: capabilityDescriptions(c),
    bffEndpoint: ctx.vars.bffEndpoint,
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
  const projected: Array<{ name: string; type: string; description: string }> = [];
  for (const entry of caps) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [name, config] of Object.entries(entry as Record<string, unknown>)) {
      const cfg = config as { type?: string } | undefined;
      projected.push({
        name,
        type: cfg?.type === 'platform' ? 'platform' : 'domain',
        description: descriptions[name] ?? '',
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
export const SWIFT_SPECS: FileSpec[] = [
  // Developer-owned scaffolding
  { template: 'Package.swift.ejs', out: `${SWIFT_DIR}/Package.swift`, owner: 'developer', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'README.md.ejs', out: `${SWIFT_DIR}/README.md`, owner: 'developer', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Sources/Features/CapabilityViews.swift.ejs', out: `${SOURCES}/Features/CapabilityViews.swift`, owner: 'developer', root: 'swift', when: hasSwift, vars: swiftVars },

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
  { template: 'Sources/Platform/CapabilityViewRegistry.swift.ejs', out: `${PLATFORM}/CapabilityViewRegistry.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
  { template: 'Tests/LifecycleTests.swift.ejs', out: `${SWIFT_DIR}/Tests/MFETests/LifecycleTests.swift`, owner: 'generator', root: 'swift', when: hasSwift, vars: swiftVars },
];

/** Absolute, resolved inside this package. From dist/ that is ../templates. */
export const swiftTemplateRoot = path.resolve(__dirname, '..', 'templates');

registerFileContributor({ id: 'swift', templateRoot: swiftTemplateRoot, specs: SWIFT_SPECS });

export type { GeneratedFile };
