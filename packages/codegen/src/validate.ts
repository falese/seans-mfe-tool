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
const NATIVE_VIEWS_FILE = 'swift/Sources/MFE/Features/CapabilityViews.swift';

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

  // Every domain capability a Swift target declares must have a view
  // (ADR-095/096).
  //
  // The generated `CapabilityViewRegistry.swift` references `<Cap>View`, so a
  // missing one fails to compile — but ONLY on Apple platforms: the reference
  // sits inside `#if canImport(SwiftUI)` and compiles out on Linux, where the
  // package otherwise builds fine. There the id still lands in `declared`,
  // `mount()` still accepts it via `declared.contains`, and rendering that
  // capability succeeds with nothing behind it.
  //
  // So the check belongs here rather than being left to a compiler that may
  // not run. Same skip posture as `slots-implemented`: no swift target or no
  // sources means the rule is not evaluated, rather than reporting every
  // capability as missing.
  const swiftTarget = (manifest as { targets?: { swift?: unknown } }).targets?.swift;
  const viewsFile = sources?.find((s) => s.path.replace(/\\/g, '/').endsWith(NATIVE_VIEWS_FILE));
  if (swiftTarget !== undefined && viewsFile) {
    checked.push('native-capability-view');
    for (const capability of domainCapabilityNames(manifest)) {
      // Anchored: `CrewRosterDetailView` must not satisfy `CrewRoster`.
      const declaresView = new RegExp(`\\bstruct\\s+${capability}View\\b`).test(viewsFile.text);
      if (declaresView) continue;
      issues.push({
        rule: 'native-capability-view',
        package: capability,
        location: NATIVE_VIEWS_FILE,
        message:
          `The Swift target declares domain capability "${capability}", ` +
          `but no ${capability}View is declared in`,
        fix:
          `Add \`public struct ${capability}View: View\` to ` +
          `swift/Sources/MFE/Features/CapabilityViews.swift. That file is ` +
          `developer-owned, so regeneration will never write it for you.`,
      });
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
