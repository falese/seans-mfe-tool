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

import { findUnreferencedSlots, type SourceFile } from '@falese/smt-dsl';
import type { DSLManifest, LifecycleHook } from '@falese/smt-dsl';
import { DEPENDENCY_VERSIONS, resolveClientDependencies } from './unified-generator';
import { findLaneLockedDependencies } from './lockfile';
import {
  PLATFORM_MIGRATIONS,
  findMigrationHits,
  severityFor,
} from './platform-migrations';

const RUNTIME_PACKAGE = '@falese/smt-runtime';

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
  /**
   * The MFE's package-lock.json, verbatim, for the lane-independence rule
   * (ADR-084 §5). Optional — an MFE that ships no lock has nothing to pin, and
   * the rule is skipped rather than reported.
   */
  lockfileText?: string;
  /**
   * The MFE's root tsconfig.json, verbatim, for the compile-contract rule
   * (ADR-085). Optional — an MFE without one is skipped rather than reported.
   */
  tsconfigText?: string;
}

export type ValidationRule =
  | 'react-pinned'
  | 'manifest-package-sync'
  | 'shared-declared'
  | 'shared-version-sync'
  | 'runtime-declared'
  | 'slots-implemented'
  | 'platform-migrations'
  | 'lifecycle-hook-handler-resolvable'
  | 'lockfile-lane-independent'
  | 'compile-contract-inherited';

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
export function validateMfeConsistency(input: MfeValidationInput): MfeValidationResult {
  const { manifest, framework, packageDependencies, sharedEntries, sources, developerOwned, platformVersion, lockfileText, tsconfigText } =
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

  // The runtime must be declared — and as a semver range, not a path.
  //
  // ADR-084 §4: the manifest states a plain range so `.npmrc` decides the
  // delivery lane. A `file:` specifier names a lane inside the manifest, which
  // is the staging model that ADR replaced; it also only resolves from one
  // checkout layout, so it silently breaks anywhere else. Checking presence
  // alone let the entire meridian fleet sit on `file:../../../dist/runtime`
  // through every gate.
  checked.push('runtime-declared');
  if (packageDependencies[RUNTIME_PACKAGE] === undefined) {
    issues.push({
      rule: 'runtime-declared',
      package: RUNTIME_PACKAGE,
      message: `${RUNTIME_PACKAGE} must be declared as a dependency`,
    });
  }
  for (const [name, spec] of Object.entries(packageDependencies)) {
    if (!name.startsWith('@falese/smt-')) continue;
    if (!spec.startsWith('file:')) continue;
    issues.push({
      rule: 'runtime-declared',
      package: name,
      expected: 'a semver range, e.g. ^0.1.0',
      actual: spec,
      message: `"${name}" is declared as "${spec}" — a path specifier pins this MFE to one checkout layout and one delivery lane, which is the staging model ADR-084 replaced`,
      fix: `Change it to a semver range (e.g. "^0.1.0") and let .npmrc choose the registry: GitHub Packages when hosted, the CLI image's mirror when offline.`,
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
  // Matching is delegated to @falese/smt-dsl so the needle logic (literal prefix
  // before the first {param}) has one implementation.
  const providesSlots = (manifest as { providesSlots?: { id: string; description?: string }[] })
    .providesSlots;
  if (providesSlots?.length && sources) {
    checked.push('slots-implemented');

    // Only app code counts as an implementation. Generator-owned files mirror
    // the manifest by construction — `bootstrap.ts` embeds the whole thing as
    // JSON — so every declared id appears in them verbatim and every slot looks
    // registered. That made the rule vacuous on any MFE that had been built:
    // adding a slot no component registers was reported correctly, then went
    // silent as soon as regeneration ran. `collectSources` hand-excluded
    // `slots.tsx` for precisely this reason and could not know about the rest;
    // file ownership (ADR-043) is the general form of that exclusion.
    //
    // The empty-result fallback is not defensive padding: `developerOwned`
    // answers "nothing is developer-owned" when codegen could not run at all,
    // and filtering on that would report every declared slot as missing. For
    // this rule the safe direction is to say nothing, not everything.
    const authored = developerOwned ? sources.filter((s) => developerOwned(s.path)) : sources;
    const ownershipUnusable = authored.length === 0 && sources.length > 0;

    if (!ownershipUnusable) {
      for (const finding of findUnreferencedSlots(providesSlots, authored)) {
        issues.push({
          rule: 'slots-implemented',
          package: finding.slotId,
          message: finding.message,
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

  // A lockfile that names a delivery lane (ADR-084 §5). `npm ci` fetches from
  // the lock's `resolved` URL and ignores the .npmrc scoped registry, so a lock
  // built in one lane fails in the other. Reported as a warning: the MFE is
  // internally consistent and builds fine in the lane it was locked in — what
  // is wrong is that it stopped being portable.
  if (lockfileText) {
    checked.push('lockfile-lane-independent');
    for (const hit of findLaneLockedDependencies(lockfileText)) {
      issues.push({
        rule: 'lockfile-lane-independent',
        severity: 'warning',
        package: hit.name,
        location: 'package-lock.json',
        message:
          `"${hit.name}" is locked to ${hit.resolved}, which pins this MFE to one delivery lane — ` +
          '`npm ci` reads that URL and ignores the registry your .npmrc selects (ADR-084)',
        fix: 'Remove the "resolved" field from this entry in package-lock.json, keeping "integrity". npm then resolves it through @falese:registry, and integrity still verifies the tarball.',
      });
    }
  }

  // A tsconfig.json that states its own module system instead of inheriting the
  // platform contract (ADR-085). Detected here rather than as a platform
  // migration because migrations only scan files under `src/` with a source
  // extension — nothing at the MFE root can ever reach one.
  //
  // A warning: the MFE compiles fine as it stands. What it has lost is the
  // ability to receive a compiler setting the platform needs, which is how the
  // fleet ended up running two incompatible module systems unnoticed.
  //
  // React only, matching ADR-085's scope: the Angular variant carries its own
  // multi-tsconfig split with a documented Mesh constraint on the root module,
  // and gets no platform file to extend — flagging it would be reporting a
  // decision the ADR deliberately deferred.
  if (tsconfigText && framework === 'react') {
    checked.push('compile-contract-inherited');
    const inherits = /"extends"\s*:\s*"\.\/tsconfig\.platform\.json"/.test(tsconfigText);
    const declaresOwnModuleSystem = /"moduleResolution"\s*:/.test(tsconfigText);
    if (!inherits && declaresOwnModuleSystem) {
      issues.push({
        rule: 'compile-contract-inherited',
        severity: 'warning',
        package: 'tsconfig.json',
        location: 'tsconfig.json',
        message:
          'tsconfig.json declares its own module system instead of extending tsconfig.platform.json, so a compiler setting the platform changes cannot reach this MFE (ADR-085)',
        fix: 'Run `remote:generate` to emit tsconfig.platform.json, add "extends": "./tsconfig.platform.json" to tsconfig.json, and delete the options it now inherits (target, module, moduleResolution, jsx, lib, strict, esModuleInterop, skipLibCheck, resolveJsonModule, forceConsistentCasingInFileNames). include/exclude/paths/outDir stay yours.',
      });
    }
  }

  return { ok: issues.every((i) => !isError(i)), checked, issues };
}
