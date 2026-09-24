/**
 * The Rust native target's contribution to MFE code generation (ADR-099).
 *
 * `remote:generate` emits a Cargo library crate into an MFE whose manifest
 * declares a `targets.rust` block — a SECOND artifact built from the SAME
 * manifest, beside the Module Federation remote (ADR-095).
 *
 * The same seam the Swift lane uses: a `FileContributor` with its own template
 * root, gated on its manifest section the way the BFF is gated on `data:`, and
 * registered by the plugin that also owns the build lifecycle (ADR-097). Which
 * is why adding this lane changes no line of `unified-generator.ts`.
 *
 * What differs from Swift is recorded in ADR-099 and is mostly subtraction:
 * no UI layer (there is no Rust UI framework to target), no build-time
 * manifest re-derivation (the metadata is rendered at generation time and
 * `check:mfe-drift` guards it), and no default HTTP client (std has none; the
 * host injects one).
 */

import * as path from 'path';
import {
  registerFileContributor,
  snakeCase,
  type FileSpec,
  type GeneratedFile,
} from '@seans-mfe/codegen';
import {
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
  MFE_LIFECYCLE_STATES,
  MFE_LIFECYCLE_TRANSITIONS,
} from '@seans-mfe/contracts';

const RUST_DIR = 'rust';
const SRC = `${RUST_DIR}/src`;
const PLATFORM = `${SRC}/platform`;
const FEATURES = `${SRC}/features`;

/** Result type per capability, as a Rust type. */
const RUST_RESULTS: Record<string, string> = {
  void: '()',
  boolean: 'bool',
};

/** The plan context, as much of it as these specs read. */
interface RustCtx {
  manifest: {
    name: string;
    version: string;
    capabilities?: unknown;
    targets?: { rust?: RustTargetConfig };
  };
  vars: { bffEndpoint?: string };
  domainCapabilities: string[];
  /** True when the manifest declares a `data:` section — i.e. there is a BFF. */
  hasBff: boolean;
}

interface RustTargetConfig {
  crateName?: string;
  edition?: string;
  capabilities?: string[];
  wasm?: boolean;
}

const rustTarget = (c: unknown): RustTargetConfig | undefined =>
  (c as RustCtx).manifest.targets?.rust;

/** Every spec's gate — the direct analogue of the BFF's `hasBff`. */
const hasRust = (c: unknown): boolean => rustTarget(c) !== undefined;

/** The Rust target AND a BFF to talk to (ADR-012). */
const hasRustBff = (c: unknown): boolean => hasRust(c) && (c as RustCtx).hasBff;

/** The Rust target AND its browser build (ADR-100). */
const hasRustWasm = (c: unknown): boolean => hasRust(c) && rustTarget(c)?.wasm === true;

/**
 * Text for a Rust string literal.
 *
 * The templates use `<%-` with this helper rather than `<%=`: EJS HTML-escapes,
 * and Rust has nothing to decode `&amp;` back — the defect the Swift lane
 * shipped once (`swiftText`).
 */
export function rustText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n');
}

/** Text for a `///` doc comment: one line, no HTML escaping. */
export function rustDoc(value: string): string {
  return value.replace(/\r?\n/g, ' ');
}

/** `crew-services` → `CrewServices`. Must be a legal Rust type name. */
export function pascalCase(name: string): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  // A leading digit is not a legal identifier start.
  return /^[0-9]/.test(joined) ? `Mfe${joined}` : joined || 'Mfe';
}

/**
 * Capability → Rust module name. Owned by `@seans-mfe/codegen` because
 * `mfe:validate` looks for `<snake>_query.rs` by the same rule.
 */
export { snakeCase };

/**
 * Cargo package name: explicit override, else the MFE name.
 *
 * Hyphens are legal in a package name — Cargo derives the library name by
 * replacing them with underscores — so kebab-case passes through. A leading
 * digit is not legal, and gets the same prefix the Swift lane gives it.
 */
export function crateNameFor(c: unknown): string {
  const explicit = rustTarget(c)?.crateName;
  if (explicit) return explicit;
  const raw = (c as RustCtx).manifest.name.replace(/[^A-Za-z0-9_-]+/g, '-');
  return /^[0-9]/.test(raw) ? `mfe-${raw}` : raw;
}

/** The library name Rust code imports: the package name with `-` → `_`. */
export function libNameFor(c: unknown): string {
  return crateNameFor(c).replace(/-/g, '_');
}

/**
 * The Module Federation scope the browser build registers under (ADR-100).
 *
 * Deliberately NOT the React remote's scope (`name` with `-` → `_`): both
 * builds of one MFE must be able to sit on the same page, and a container is
 * a global keyed by scope.
 */
export function wasmScopeFor(c: unknown): string {
  return `${libNameFor(c)}_wasm`;
}

/** Prefix for the crate's public types: `MeridianCrewServicesMfe`. */
export function typePrefixFor(c: unknown): string {
  return pascalCase(crateNameFor(c));
}

/**
 * The domain capabilities THIS target implements (ADR-095).
 *
 * `targets.rust.capabilities` names a subset; omitted means all of them. A
 * name the manifest does not declare is dropped here and reported by
 * `mfe:validate`.
 */
function selectedCapabilities(c: unknown): string[] {
  const all = (c as RustCtx).domainCapabilities;
  const declared = rustTarget(c)?.capabilities;
  if (!declared) return all;
  return declared.filter((name) => all.includes(name));
}

/** Manifest capability descriptions, keyed by capability name. */
function capabilityDescriptions(c: unknown): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  const caps = (c as RustCtx).manifest.capabilities;
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
 * Read from `@seans-mfe/contracts` rather than restated — ADR-080's rule, and
 * ADR-096 §3's applied one language further out.
 */
function contractVars(): Record<string, unknown> {
  return {
    lifecycleStates: MFE_LIFECYCLE_STATES.map((name) => ({ name, pascal: pascalCase(name) })),
    lifecycleTransitions: MFE_LIFECYCLE_STATES.map((from) => ({
      from: pascalCase(from),
      to: [...(MFE_LIFECYCLE_TRANSITIONS[from] ?? [])].map(pascalCase),
    })),
    platformCapabilities: PLATFORM_CAPABILITIES.map((name) => {
      const spec = PLATFORM_CAPABILITY_SPECS[name];
      const state = (s: string | undefined): string =>
        s ? `Some(MfeLifecycleState::${pascalCase(s)})` : 'None';
      return {
        name,
        pascal: name.charAt(0).toUpperCase() + name.slice(1),
        snake: snakeCase(name),
        description: spec.description,
        rustResult: RUST_RESULTS[spec.resultType] ?? spec.resultType,
        preStates: [...spec.preStates].map(pascalCase),
        enterState: state(spec.enterState),
        exitState: state(spec.exitState),
        errorState: state(spec.errorState),
      };
    }),
  };
}

interface HookProjection {
  capability: string;
  phase: string;
  hook: string;
  handlers: string[];
  contained: boolean;
}

/**
 * A capability's manifest `lifecycle:` block, flattened (ADR-040, ADR-098 §5).
 *
 * Only for capabilities this target carries: a domain capability it does not
 * implement is not part of its contract.
 */
function manifestHooks(c: unknown): HookProjection[] {
  const out: HookProjection[] = [];
  const caps = (c as RustCtx).manifest.capabilities;
  if (!Array.isArray(caps)) return out;
  const selected = new Set(selectedCapabilities(c));
  for (const entry of caps) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [capability, config] of Object.entries(entry as Record<string, unknown>)) {
      const cfg = config as { type?: string; lifecycle?: Record<string, unknown> } | undefined;
      if (cfg?.type !== 'platform' && !selected.has(capability)) continue;
      const lifecycle = cfg?.lifecycle;
      if (!lifecycle || typeof lifecycle !== 'object') continue;
      for (const phase of ['before', 'main', 'after', 'error']) {
        const entries = lifecycle[phase];
        if (!Array.isArray(entries)) continue;
        for (const hookEntry of entries) {
          if (!hookEntry || typeof hookEntry !== 'object') continue;
          for (const [hook, raw] of Object.entries(hookEntry as Record<string, unknown>)) {
            const hc = raw as { handler?: unknown; contained?: unknown } | undefined;
            const handler = hc?.handler;
            // REQ-045: a handler may be a single name or an array, run in order.
            const handlers = Array.isArray(handler)
              ? handler.filter((h): h is string => typeof h === 'string')
              : typeof handler === 'string'
                ? [handler]
                : [];
            if (handlers.length === 0) continue;
            out.push({ capability, phase, hook, handlers, contained: hc?.contained === true });
          }
        }
      }
    }
  }
  return out;
}

/** Every handler the manifest names, deduplicated, with where it came from. */
function manifestHandlers(
  c: unknown,
): Array<{ handler: string; capability: string; phase: string; hook: string }> {
  const seen = new Set<string>();
  const out: Array<{ handler: string; capability: string; phase: string; hook: string }> = [];
  for (const spec of manifestHooks(c)) {
    for (const handler of spec.handlers) {
      if (seen.has(handler)) continue;
      seen.add(handler);
      out.push({ handler, capability: spec.capability, phase: spec.phase, hook: spec.hook });
    }
  }
  return out;
}

/** Capabilities `describe` reports: every platform one, plus the selected domain ones. */
function describedCapabilities(
  c: unknown,
): Array<{ name: string; type: string; description: string }> {
  const out: Array<{ name: string; type: string; description: string }> = [];
  const caps = (c as RustCtx).manifest.capabilities;
  if (!Array.isArray(caps)) return out;
  const selected = new Set(selectedCapabilities(c));
  const descriptions = capabilityDescriptions(c);
  for (const entry of caps) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [name, config] of Object.entries(entry as Record<string, unknown>)) {
      const isPlatform = (config as { type?: string } | undefined)?.type === 'platform';
      if (!isPlatform && !selected.has(name)) continue;
      out.push({ name, type: isPlatform ? 'platform' : 'domain', description: descriptions[name] ?? '' });
    }
  }
  return out;
}

/** Vars every Rust template gets. */
const rustVars = (c: unknown): Record<string, unknown> => {
  const ctx = c as RustCtx;
  return {
    ...contractVars(),
    manifestName: ctx.manifest.name,
    manifestVersion: ctx.manifest.version,
    crateName: crateNameFor(c),
    libName: libNameFor(c),
    typePrefix: typePrefixFor(c),
    wasmScope: wasmScopeFor(c),
    edition: rustTarget(c)?.edition || '2021',
    domainCapabilities: selectedCapabilities(c),
    capabilityDescriptions: capabilityDescriptions(c),
    describedCapabilities: describedCapabilities(c),
    hooks: manifestHooks(c),
    manifestHandlers: manifestHandlers(c),
    // Only when there IS a BFF. The render model composes an endpoint for
    // every manifest, `data:` or not, and baking that in would have `query`
    // dial a BFF that was never generated instead of answering ADR-070's
    // uniform no-data result.
    bffEndpoint: hasRustBff(c) ? ctx.vars.bffEndpoint : undefined,
    hasBff: hasRustBff(c),
    snake: snakeCase,
    pascal: pascalCase,
    rustText,
    rustDoc,
  };
};

/**
 * `platform/` is generator-owned, `features/` is developer-owned — the web
 * lane's `src/platform/**` / `src/features/**` split, restated.
 *
 * Two exceptions, both in the direction that keeps regeneration safe:
 *
 *   - `src/lib.rs` is developer-owned. It only declares `platform` and
 *     `features`, which always exist, so regeneration never needs to change it
 *     — and a developer adding their own module must be able to.
 *   - `src/features/mod.rs` is generator-owned. It declares one module per
 *     capability query, so a capability added to the manifest is declared the
 *     moment its seeded file is written, rather than needing a hand-edit to a
 *     developer-owned file regeneration will never touch.
 *
 * `rust/.gitignore` is emitted here rather than appended to the MFE root
 * `.gitignore`, which is variant-owned (`gitignore-ownership.test.ts`).
 */
const STATIC_RUST_SPECS: FileSpec[] = [
  // Developer-owned scaffolding
  { template: 'Cargo.toml.ejs', out: `${RUST_DIR}/Cargo.toml`, owner: 'developer', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'README.md.ejs', out: `${RUST_DIR}/README.md`, owner: 'developer', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/lib.rs.ejs', out: `${SRC}/lib.rs`, owner: 'developer', root: 'rust', when: hasRust, vars: rustVars },

  // Generator-owned: the contract and everything derived from it
  { template: 'gitignore.ejs', out: `${RUST_DIR}/.gitignore`, owner: 'generator', root: 'rust', when: hasRust },
  { template: 'src/platform/mod.rs.ejs', out: `${PLATFORM}/mod.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/error.rs.ejs', out: `${PLATFORM}/error.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/mfe_lifecycle.rs.ejs', out: `${PLATFORM}/mfe_lifecycle.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/types.rs.ejs', out: `${PLATFORM}/types.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/manifest_metadata.rs.ejs', out: `${PLATFORM}/manifest_metadata.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/mfe_base.rs.ejs', out: `${PLATFORM}/mfe_base.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/native_mfe_base.rs.ejs', out: `${PLATFORM}/native_mfe_base.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/generated_mfe.rs.ejs', out: `${PLATFORM}/generated_mfe.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/data_provider.rs.ejs', out: `${PLATFORM}/data_provider.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'src/platform/executor.rs.ejs', out: `${PLATFORM}/executor.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  // The BFF client and the provider that uses it — emitted only when there is
  // a BFF (ADR-012), exactly as in the Swift lane (ADR-096 §7).
  { template: 'src/platform/bff_client.rs.ejs', out: `${PLATFORM}/bff_client.rs`, owner: 'generator', root: 'rust', when: hasRustBff, vars: rustVars },
  { template: 'src/platform/bff_data_provider.rs.ejs', out: `${PLATFORM}/bff_data_provider.rs`, owner: 'generator', root: 'rust', when: hasRustBff, vars: rustVars },
  { template: 'src/features/mod.rs.ejs', out: `${FEATURES}/mod.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
  { template: 'tests/lifecycle.rs.ejs', out: `${RUST_DIR}/tests/lifecycle.rs`, owner: 'generator', root: 'rust', when: hasRust, vars: rustVars },
];

/**
 * The browser build (ADR-100): a second crate under `rust/web/`, so enabling
 * it adds files and changes none — in particular not the developer-owned
 * `rust/Cargo.toml`, which regeneration could not update.
 *
 * Ownership mirrors the native crate: `src/platform/`, `src/features/mod.rs`,
 * the remote entry and the build script are the generator's; `Cargo.toml`,
 * `lib.rs`, the README and each capability's renderer are the developer's.
 */
const WEB = `${RUST_DIR}/web`;
const STATIC_WEB_SPECS: FileSpec[] = [
  { template: 'web/Cargo.toml.ejs', out: `${WEB}/Cargo.toml`, owner: 'developer', root: 'rust', when: hasRustWasm, vars: rustVars },
  { template: 'web/README.md.ejs', out: `${WEB}/README.md`, owner: 'developer', root: 'rust', when: hasRustWasm, vars: rustVars },
  { template: 'web/src/lib.rs.ejs', out: `${WEB}/src/lib.rs`, owner: 'developer', root: 'rust', when: hasRustWasm, vars: rustVars },
  { template: 'web/gitignore.ejs', out: `${WEB}/.gitignore`, owner: 'generator', root: 'rust', when: hasRustWasm },
  { template: 'web/build.sh.ejs', out: `${WEB}/build.sh`, owner: 'generator', root: 'rust', when: hasRustWasm, vars: rustVars },
  { template: 'web/www/remoteEntry.js.ejs', out: `${WEB}/www/remoteEntry.js`, owner: 'generator', root: 'rust', when: hasRustWasm, vars: rustVars },
  { template: 'web/src/platform/mod.rs.ejs', out: `${WEB}/src/platform/mod.rs`, owner: 'generator', root: 'rust', when: hasRustWasm, vars: rustVars },
  { template: 'web/src/features/mod.rs.ejs', out: `${WEB}/src/features/mod.rs`, owner: 'generator', root: 'rust', when: hasRustWasm, vars: rustVars },
];

/** One developer-owned renderer per capability the browser build carries. */
function webFeatureSpecs(ctx: unknown): FileSpec[] {
  if (!hasRustWasm(ctx)) return [];
  const descriptions = capabilityDescriptions(ctx);
  return selectedCapabilities(ctx).map(
    (name): FileSpec => ({
      template: 'web/src/features/capability.rs.ejs',
      out: `${WEB}/src/features/${snakeCase(name)}.rs`,
      owner: 'developer',
      root: 'rust',
      vars: () => ({ name, description: descriptions[name] ?? '', rustText }),
    }),
  );
}

/**
 * The full plan for a generation: the fixed files, plus one query document per
 * capability this target implements when there is a BFF.
 *
 * A function rather than an array because `FileSpec.out` is a static string
 * (ADR-095), so per-capability paths cannot be known until a manifest is read.
 */
export function rustSpecs(ctx: unknown): FileSpec[] {
  if (!hasRust(ctx)) return [];
  const web = [...STATIC_WEB_SPECS, ...webFeatureSpecs(ctx)];
  if (!hasRustBff(ctx)) return [...STATIC_RUST_SPECS, ...web];
  return [
    ...STATIC_RUST_SPECS,
    ...web,
    // Developer-owned for the reason the Swift lane's are: the BFF's schema is
    // composed by Mesh from `data.sources` at build time, so codegen cannot
    // know the field names (ADR-096 §7).
    ...selectedCapabilities(ctx).map(
      (name): FileSpec => ({
        template: 'src/features/capability_query.rs.ejs',
        out: `${FEATURES}/${snakeCase(name)}_query.rs`,
        owner: 'developer',
        root: 'rust',
        vars: () => ({ name, bffEndpoint: (ctx as RustCtx).vars.bffEndpoint ?? '' }),
      }),
    ),
  ];
}

/** The fixed part of the plan, for anything that wants to inspect it. */
export const RUST_SPECS = STATIC_RUST_SPECS;

/** Absolute, resolved inside this package. From dist/ that is ../templates. */
export const rustTemplateRoot = path.resolve(__dirname, '..', 'templates');

/**
 * Register the Rust file contribution. Called by
 * `RustCargoPlugin.registerCodegen()` (ADR-097); idempotent because
 * `registerFileContributor` keys by id.
 */
export function registerRustCodegen(): void {
  registerFileContributor({ id: 'rust', templateRoot: rustTemplateRoot, specs: rustSpecs });
}

export type { GeneratedFile };
