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

import type { DSLManifest } from '@seans-mfe/dsl';
import { DEPENDENCY_VERSIONS, resolveClientDependencies } from './unified-generator';

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
}

export type ValidationRule =
  | 'react-pinned'
  | 'manifest-package-sync'
  | 'shared-declared'
  | 'shared-version-sync'
  | 'runtime-declared';

export interface ValidationIssue {
  rule: ValidationRule;
  message: string;
  expected?: string;
  actual?: string;
  package?: string;
}

export interface MfeValidationResult {
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

/**
 * Validate an MFE's internal dependency/federation consistency. Pure: no I/O.
 */
export function validateMfeConsistency(input: MfeValidationInput): MfeValidationResult {
  const { manifest, framework, packageDependencies, sharedEntries } = input;
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

  return { ok: issues.length === 0, checked, issues };
}
