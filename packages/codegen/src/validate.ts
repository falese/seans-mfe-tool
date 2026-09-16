/**
 * MFE internal-consistency validator (#296).
 *
 * A pure, framework-agnostic checker: given a parsed manifest, the MFE's
 * package.json dependency map, and the Module-Federation `shared` entries, it
 * asserts the invariants that codegen establishes (ADR-050 dependency
 * governance, ADR-071 manifest-driven deps) but that hand-edits can silently
 * break — the class of drift behind the meridian-docking-simulation regression.
 *
 * It is intentionally I/O-free: reading files, parsing the bundler config, and
 * running `tsc --noEmit` are the command layer's job (`mfe:validate`). Keeping
 * the rules pure makes them unit-testable in the platform, not per example.
 */

import { findUnreferencedSlots, type SourceFile } from '@seans-mfe/dsl';
import type { DSLManifest, LifecycleHook } from '@seans-mfe/dsl';
import { DEPENDENCY_VERSIONS, resolveClientDependencies } from './unified-generator';
import {
  PLATFORM_MIGRATIONS,
  findMigrationHits,
  severityFor,
} from './platform-migrations';

const RUNTIME_PACKAGE = '@seans-mfe-tool/runtime';

/** A framework singleton the bundler shares; parsed from the federation config. */
export interface SharedEntry {
  name: string;
  requiredVersion: string;
}

export interface MfeValidationInput {
  manifest: DSLManifest;
  framework: string;
  /** Merged dependencies + devDependencies from the MFE's package.json. */
  packageDependencies: Record<string, string>;
  /** `shared` entries parsed from rspack/webpack federation config. */
  sharedEntries: SharedEntry[];
  /**
   * The MFE's own source files, for the slot rule (ADR-073). Optional: the
   * function stays usable without the command layer's file IO, and the rule is
   * skipped when they are absent rather than reporting false positives.
   */
  sources?: SourceFile[];
  /**
   * Predicate identifying files the generator seeds but does not own
   * (`overwrite: false`), plus anything it never emits. Only these are scanned
   * for platform migrations — see the rule below. Absent skips the rule.
   */
  developerOwned?: (sourcePath: string) => boolean;
  /** Running platform version, for migration `failsAt` escalation (ADR-082). */
  platformVersion?: string;
}

export type ValidationRule =
  | 'react-pinned'
  | 'manifest-package-sync'
  | 'shared-declared'
  | 'shared-version-sync'
  | 'runtime-declared'
  | 'slots-implemented'
  | 'native-capability-view'
  | 'native-capability-query'
  | 'capability-has-a-target'
  | 'native-views-legacy-file'
  | 'platform-migrations'
  | 'lifecycle-hook-handler-resolvable';

/**
 * `error` fails validation; `warning` reports and does not.
 *
 * Introduced for ADR-082: regeneration cannot reach developer-owned files, so
 * the platform needs a way to say "this is yours, and something it uses has
 * changed" without failing anyone's build. Optional, and absent means `error`,
 * so every rule written before this behaves exactly as it did.
 */
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  rule: ValidationRule;
  message: string;
  expected?: string;
  actual?: string;
  package?: string;
  /** Defaults to `error` when absent. */
  severity?: ValidationSeverity;
  /** `path:line` for issues found in a specific source file. */
  location?: string;
  /** What to do about it, for rules that can say. */
  fix?: string;
}

/** An issue fails validation unless it explicitly says it is only a warning. */
export function isError(issue: ValidationIssue): boolean {
  return (issue.severity ?? 'error') === 'error';
}

export interface MfeValidationResult {
  /** False only when at least one issue is an `error` — warnings do not fail. */
  ok: boolean;
  /** Rules that were evaluated (framework-dependent). */
  checked: ValidationRule[];
  issues: ValidationIssue[];
}

/**
 * Extract Module-Federation `shared` entries from a bundler config's source
 * text (rspack.config.js / webpack.config.js). Matches every
 * `name: { … requiredVersion: '…' … }` object, which is exactly the generated
 * federation `shared` shape (ADR-071) and the common hand-authored form.
 *
 * Text-based (not eval) so it is pure and safe on untrusted config; entries
 * without a `requiredVersion` (e.g. `shareAll` spreads) are ignored.
 */
export function parseFederationSharedEntries(configSource: string): SharedEntry[] {
  const entries: SharedEntry[] = [];
  const re = /(['"]?)([@\w][\w./-]*)\1\s*:\s*\{[^{}]*?requiredVersion\s*:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(configSource)) !== null) {
    entries.push({ name: m[2], requiredVersion: m[3] });
  }
  return entries;
}

/** One `handler:` value that will never resolve at runtime, and why. */
export interface UnresolvableHookHandler {
  capability: string;
  hookName: string;
  phase: 'before' | 'main' | 'after' | 'error';
  handler: string;
}

const LIFECYCLE_PHASES = ['before', 'main', 'after', 'error'] as const;

/**
 * Lifecycle hooks whose `handler:` cannot resolve at runtime, given how
 * codegen names things.
 *
 * Codegen always keys the generated artifact by the hook's own YAML key: a
 * stub method named after it (no `source:`), or a `handler-registry.ts` DI
 * entry named after it (`source:` present, ADR-040 — its own worked example
 * imports `{ <hookName> }`). The runtime always resolves a hook by its
 * `handler:` field (`BaseMFE.executeHook` → `invokeHandler(hookConfig.handler, ...)`),
 * stripping a dotted prefix down to the last segment first (so
 * `custom.onLoadBegin` resolves the same as `onLoadBegin`) — except
 * `platform.*`, which never goes through codegen-generated names at all; it
 * resolves from the static platform handler library.
 *
 * Every real example manifest keeps `handler:` and the hook's key identical,
 * which is why this has never surfaced: the two names are only ever
 * different by mistake, and nothing has ever said so out loud.
 */
export function findUnresolvableLifecycleHooks(manifest: DSLManifest): UnresolvableHookHandler[] {
  const found: UnresolvableHookHandler[] = [];

  for (const capabilityEntry of manifest.capabilities ?? []) {
    for (const [capabilityName, capabilityConfig] of Object.entries(capabilityEntry)) {
      const lifecycle = capabilityConfig?.lifecycle;
      if (!lifecycle) continue;

      for (const phase of LIFECYCLE_PHASES) {
        for (const hookEntry of lifecycle[phase] ?? []) {
          for (const [hookName, hookConfig] of Object.entries(hookEntry)) {
            const handlers = normalizeHandlers((hookConfig as LifecycleHook).handler);
            for (const handler of handlers) {
              if (handler.startsWith('platform.')) continue; // static library, not codegen-named
              const lastSegment = handler.includes('.') ? handler.split('.').pop()! : handler;
              if (lastSegment !== hookName) {
                found.push({ capability: capabilityName, hookName, phase, handler });
              }
            }
          }
        }
      }
    }
  }

  return found;
}

function normalizeHandlers(handler: string | string[]): string[] {
  return Array.isArray(handler) ? handler : [handler];
}

/**
 * Validate an MFE's internal dependency/federation consistency. Pure: no I/O.
 */
/** Where the developer-owned SwiftUI views live, relative to the MFE root. */
const NATIVE_FEATURES_DIR = 'swift/Sources/MFE/Features/';

/** Domain capability names, in manifest order. Platform capabilities have no view. */
function domainCapabilityNames(manifest: DSLManifest): string[] {
  const names: string[] = [];
  for (const entry of manifest.capabilities ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [name, config] of Object.entries(entry as Record<string, unknown>)) {
      if ((config as { type?: string } | undefined)?.type === 'domain') names.push(name);
    }
  }
  return names;
}

export function validateMfeConsistency(input: MfeValidationInput): MfeValidationResult {
  const { manifest, framework, packageDependencies, sharedEntries, sources, developerOwned, platformVersion } =
    input;
  const issues: ValidationIssue[] = [];
  const checked: ValidationRule[] = [];

  // react/react-dom pinned to the platform version (React MFEs only, ADR-050/#293).
  if (framework === 'react') {
    checked.push('react-pinned');
    const pins: Array<[string, string]> = [
      ['react', DEPENDENCY_VERSIONS.react.react],
      ['react-dom', DEPENDENCY_VERSIONS.react.reactDom],
    ];
    for (const [pkg, expected] of pins) {
      const actual = packageDependencies[pkg];
      if (actual !== expected) {
        issues.push({
          rule: 'react-pinned',
          package: pkg,
          expected,
          actual,
          message: `${pkg} must be pinned to the platform version ${expected} (found ${actual ?? 'absent'})`,
        });
      }
    }
  }

  // Every dependency the manifest implies must be declared with the same version.
  checked.push('manifest-package-sync');
  const expectedDeps = resolveClientDependencies(manifest, framework);
  for (const [pkg, expected] of Object.entries(expectedDeps)) {
    const actual = packageDependencies[pkg];
    if (actual === undefined) {
      issues.push({
        rule: 'manifest-package-sync',
        package: pkg,
        expected,
        message: `manifest implies dependency "${pkg}" (${expected}) but it is absent from package.json`,
      });
    } else if (actual !== expected) {
      issues.push({
        rule: 'manifest-package-sync',
        package: pkg,
        expected,
        actual,
        message: `dependency "${pkg}" is ${actual} in package.json but the manifest implies ${expected}`,
      });
    }
  }

  // Every federation `shared` key must be a declared dependency, and framework
  // singletons must share the platform version.
  checked.push('shared-declared', 'shared-version-sync');
  const frameworkVersions: Record<string, string> = {
    react: DEPENDENCY_VERSIONS.react.react,
    'react-dom': DEPENDENCY_VERSIONS.react.reactDom,
  };
  for (const entry of sharedEntries) {
    if (packageDependencies[entry.name] === undefined) {
      issues.push({
        rule: 'shared-declared',
        package: entry.name,
        message: `federation shares "${entry.name}" but it is not a declared dependency`,
      });
    }
    const platformVersion = frameworkVersions[entry.name];
    if (platformVersion !== undefined && entry.requiredVersion !== platformVersion) {
      issues.push({
        rule: 'shared-version-sync',
        package: entry.name,
        expected: platformVersion,
        actual: entry.requiredVersion,
        message: `federation requiredVersion for "${entry.name}" is ${entry.requiredVersion} but the platform version is ${platformVersion}`,
      });
    }
  }

  // The runtime must be declared.
  checked.push('runtime-declared');
  if (packageDependencies[RUNTIME_PACKAGE] === undefined) {
    issues.push({
      rule: 'runtime-declared',
      package: RUNTIME_PACKAGE,
      message: `${RUNTIME_PACKAGE} must be declared as a dependency`,
    });
  }

  // Every lifecycle hook's `handler:` must resolve to what codegen actually
  // names (see findUnresolvableLifecycleHooks). Unconditional — reads only
  // the manifest, no file IO required.
  checked.push('lifecycle-hook-handler-resolvable');
  for (const hit of findUnresolvableLifecycleHooks(manifest)) {
    issues.push({
      rule: 'lifecycle-hook-handler-resolvable',
      package: hit.hookName,
      expected: hit.hookName,
      actual: hit.handler,
      message: `lifecycle hook "${hit.hookName}" (capability "${hit.capability}", ${hit.phase} phase) declares handler "${hit.handler}", but codegen names the generated stub/registry entry after the hook's own key "${hit.hookName}" — "${hit.handler}" will never resolve at runtime`,
      fix: `Set handler: ${hit.hookName} to match the hook's key (or rename the hook's key to "${hit.handler}")`,
    });
  }

  // Every slot the manifest declares should actually be registered by app code
  // (ADR-073). A declared slot nothing registers is silent at runtime: ADR-066
  // parks a placement aimed at it and waits indefinitely, by design.
  //
  // Skipped when the MFE declares no slots, or when the caller supplied no
  // sources — a scan over nothing would report every declaration as missing.
  // Matching is delegated to @seans-mfe/dsl so the needle logic (literal prefix
  // before the first {param}) has one implementation.
  const providesSlots = (manifest as { providesSlots?: { id: string; description?: string }[] })
    .providesSlots;
  if (providesSlots?.length && sources) {
    checked.push('slots-implemented');
    for (const finding of findUnreferencedSlots(providesSlots, sources)) {
      issues.push({
        rule: 'slots-implemented',
        package: finding.slotId,
        message: finding.message,
      });
    }
  }

  // Every capability a Swift target implements must have its view file
  // (ADR-095/096).
  //
  // A BACKSTOP, not the mechanism. Views are emitted one per capability, so a
  // capability added to the manifest gets its own new file that regeneration
  // writes — the web lane's behaviour. This rule catches the remaining case: a
  // view someone deleted.
  //
  // It exists at all because the compiler cannot be relied on here. The
  // registry's reference to `<Cap>View` sits inside `#if canImport(SwiftUI)`,
  // which compiles out on Linux, where the package otherwise builds — so the
  // id would still reach `declared`, `mount()` would still accept it, and the
  // capability would render nothing.
  const swiftTarget = (manifest as { targets?: { swift?: { capabilities?: string[] } } }).targets
    ?.swift;
  if (swiftTarget !== undefined && sources) {
    checked.push('native-capability-view');
    const domain = domainCapabilityNames(manifest);
    const implemented = swiftTarget.capabilities
      ? swiftTarget.capabilities.filter((name) => domain.includes(name))
      : domain;
    // Suffix, not prefix: `sources` carries absolute paths (the command
    // relativises locations when printing, so it cannot hand relative ones in).
    const present = new Set(
      sources
        .map((f) => f.path.replace(/\\/g, '/'))
        .filter((p) => p.includes(`/${NATIVE_FEATURES_DIR}`) && p.endsWith('View.swift'))
        .map((p) => p.slice(p.lastIndexOf('/') + 1).replace(/View\.swift$/, '')),
    );
    for (const capability of implemented) {
      if (present.has(capability)) continue;
      const file = `${NATIVE_FEATURES_DIR}${capability}View.swift`;
      issues.push({
        rule: 'native-capability-view',
        package: capability,
        // No `location`: the file is MISSING, so there is no real path to
        // relativise, and a synthesised one renders wrong.
        message:
          `The Swift target implements domain capability "${capability}", ` +
          `but ${file} does not exist.`,
        fix:
          `Restore ${file} with \`public struct ${capability}View: View\`, or ` +
          `run remote:generate to re-seed it. Removing "${capability}" from ` +
          `targets.swift.capabilities is the other way out.`,
      });
    }

    // Every capability a Swift target implements must also have its QUERY
    // document, when the manifest declares a data source (ADR-096 §7).
    //
    // Same backstop shape as the view rule above, and for a sharper reason:
    // `Platform/BFFDataProvider.swift` is GENERATOR-owned and calls
    // `<Cap>Query.document` by name, so deleting the developer-owned document
    // leaves generated code referring to a symbol nothing declares. That is the
    // generator-to-developer coupling the registry/monolith split already cost
    // us once, and the platform reports it rather than rewriting the file
    // (ADR-082).
    //
    // Unlike the view rule, a Swift compiler WOULD catch this — the provider is
    // not behind `#if canImport(SwiftUI)`. Nothing in CI runs one, and
    // `cannot find 'CrewRosterQuery' in scope` names the symbol and no fix.
    const hasBff = (manifest as { data?: unknown }).data !== undefined;
    if (hasBff) {
      checked.push('native-capability-query');
      const seeded = new Set(
        sources
          .map((f) => f.path.replace(/\\/g, '/'))
          .filter((p) => p.includes(`/${NATIVE_FEATURES_DIR}`) && p.endsWith('Query.swift'))
          .map((p) => p.slice(p.lastIndexOf('/') + 1).replace(/Query\.swift$/, '')),
      );
      for (const capability of implemented) {
        if (seeded.has(capability)) continue;
        const file = `${NATIVE_FEATURES_DIR}${capability}Query.swift`;
        issues.push({
          rule: 'native-capability-query',
          package: capability,
          // No `location`, for the same reason as the view rule: the file is
          // missing, so there is no real path to relativise.
          message:
            `The Swift target implements domain capability "${capability}" and ` +
            `this MFE has a BFF, but ${file} does not exist — generated ` +
            `Platform/BFFDataProvider.swift calls ${capability}Query.document.`,
          fix:
            `Restore ${file} with \`public enum ${capability}Query\` exposing a ` +
            `\`static let document\`, or run remote:generate to re-seed it.`,
        });
      }
    }

    // The pre-split monolith, if it survived (ADR-095).
    //
    // Views used to be seeded into one developer-owned `CapabilityViews.swift`.
    // They are now one file per capability, and regeneration never DELETES a
    // developer-owned file — so an MFE generated before the split keeps the old
    // file, gains the new ones, and declares every view twice.
    //
    // Not a PLATFORM_MIGRATIONS entry: `findMigrationHits` matches line by
    // line, and the old and new files contain byte-identical lines
    // (`public struct CrewRosterView: View {`). The distinguishing fact is the
    // file's existence, which a line matcher cannot express. Same guarantee —
    // `mfe:validate` reporting a breaking change in code the platform does not
    // own, with a fix (ADR-082) — through the mechanism that can carry it.
    const legacy = sources.find((f) =>
      f.path.replace(/\\/g, '/').endsWith(`/${NATIVE_FEATURES_DIR}CapabilityViews.swift`),
    );
    if (legacy) {
      checked.push('native-views-legacy-file');
      issues.push({
        rule: 'native-views-legacy-file',
        location: legacy.path,
        message:
          'Capability views are now one file per capability, so this pre-split ' +
          'file declares every view a second time. Regeneration cannot delete it —',
        fix:
          'Move any edits into the matching swift/Sources/MFE/Features/<Cap>View.swift ' +
          '(regeneration has already seeded them) and delete this file.',
      });
    }

    // A capability nothing builds is probably an oversight, not an error: a
    // target whose generator does not exist yet is a legitimate reason.
    if (swiftTarget.capabilities) {
      checked.push('capability-has-a-target');
      for (const capability of domain) {
        if (swiftTarget.capabilities.includes(capability)) continue;
        issues.push({
          rule: 'capability-has-a-target',
          severity: 'warning',
          package: capability,
          message:
            `Domain capability "${capability}" is not implemented by the Swift ` +
            `target. It is still built for the web.`,
          fix:
            `Add "${capability}" to targets.swift.capabilities if the native ` +
            `build should carry it.`,
        });
      }
    }
  }

  // Developer-owned code using something the platform changed (ADR-082).
  // Skipped when the caller supplies no ownership split: without it every
  // generator-owned file would be scanned too, duplicating check:mfe-drift and
  // reporting files regeneration has already fixed.
  if (sources && developerOwned) {
    checked.push('platform-migrations');
    const version = platformVersion ?? '0.0.0';
    for (const source of sources.filter((s) => developerOwned(s.path))) {
      for (const migration of PLATFORM_MIGRATIONS) {
        for (const hit of findMigrationHits(migration, source)) {
          issues.push({
            rule: 'platform-migrations',
            severity: severityFor(migration, version),
            package: migration.id,
            location: `${source.path}:${hit.line}`,
            message: `${migration.message} (${migration.adr})`,
            fix: migration.fix,
          });
        }
      }
    }
  }

  return { ok: issues.every((i) => !isError(i)), checked, issues };
}
