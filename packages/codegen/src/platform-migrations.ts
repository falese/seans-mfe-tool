/**
 * Platform migrations — what the platform changed in code it does not own
 * (ADR-082).
 *
 * The generator splits its output in two: files it owns and re-stamps, and
 * files it seeds once and then never touches, "even with `--force`". When a
 * platform contract moves, regeneration fixes the first class and cannot reach
 * the second — and until this existed, nothing reported that the second class
 * had fallen behind. Carrying ADR-017 to the fleet left 19 developer-owned
 * files stale while every gate stayed green.
 *
 * Each entry below is one such change. They are hand-written on purpose:
 * deriving them from template diffs cannot tell a contract change from a
 * comment reflow, and cannot produce the `fix` at all — which is the half a
 * developer actually needs.
 *
 * Detection is by **usage**, not staleness. "Does this code use the thing that
 * changed" reports exactly the people affected and goes quiet when they fix it.
 * "Was this file seeded before the change" would flag anyone who legitimately
 * rewrote their own file, for as long as the file existed.
 *
 * Pure: no I/O, no process access. The caller supplies the sources and the
 * platform version.
 */

/** One line of developer-owned source that uses something the platform changed. */
export interface MigrationHit {
  /** 1-indexed, so it can be printed as `path:line`. */
  line: number;
  /** The offending line, trimmed — enough to recognise without opening the file. */
  text: string;
}

export interface SourceLike {
  path: string;
  text: string;
}

export interface PlatformMigration {
  /** Stable slug. Keys any suppression a consumer writes, so it must not churn. */
  id: string;
  /** Platform version that began warning about this. */
  since: string;
  /**
   * Platform version at which the warning becomes an error. Omitted for a
   * change that is advice rather than a deadline.
   */
  failsAt?: string;
  /** What is wrong, in the developer's terms. */
  message: string;
  /** What to do instead — concrete enough to act on without reading the ADR. */
  fix: string;
  /** The decision this enforces. */
  adr: string;
  /** Lines matching this are hits. Applied per line, so a hit carries a number. */
  pattern: RegExp;
  /**
   * Lines matching this are exempt even if `pattern` matched. For the cases
   * where a single regex would either over- or under-match — see
   * `validation-error-renamed`, where only the *type* import moved.
   */
  exempt?: RegExp;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * The runtime barrel, under either scope.
 *
 * ADR-083 renamed the package from `@seans-mfe-tool/runtime` to
 * `@falese/smt-runtime`. Migrations below describe things that moved *within*
 * the barrel, and those moves are orthogonal to the rename — a developer can
 * adopt the new scope and still be on the old barrel layout. Matching one name
 * only would let exactly that combination through, so both are matched here and
 * the `fix` text names the new one.
 */
const RUNTIME_BARREL = String.raw`['"](?:@seans-mfe-tool/runtime|@falese/smt-runtime)['"]`;

export const PLATFORM_MIGRATIONS: readonly PlatformMigration[] = [
  {
    id: 'typed-errors',
    since: '1.0.0',
    failsAt: '2.0.0',
    adr: 'ADR-017',
    // Worded to avoid the literal construct, so this entry does not trip the
    // ADR-017 guard that scans this very file. The suppression marker exists
    // for prose that genuinely needs to quote it.
    message:
      'Throwing a raw `Error` — the platform classifies failures by error type, so this is reported as `unknown` and never retried',
    fix: "Throw a typed error from '@falese/smt-runtime': ValidationError (bad input), BusinessError (precondition), NetworkError (transport, carries the status), SystemError (environment), SecurityError, TimeoutError",
    // `new Error(...)` that is not thrown is a value, not a failure signal, so
    // the throw keyword is part of the match.
    pattern: /\bthrow\s+new\s+Error\s*\(/,
  },
  {
    id: 'validation-error-renamed',
    since: '1.0.0',
    failsAt: '2.0.0',
    adr: 'ADR-017',
    message:
      "`ValidationError` imported as a *type* from '@falese/smt-runtime' now refers to the thrown class; the per-field record it used to name is `ValidationIssue`",
    fix: 'Rename the type import to ValidationIssue. If you meant the throwable class, import it as a value instead of a type — that name is unchanged.',
    // Only the type position moved. `import { ValidationError }` (a value) is
    // still correct and must not be flagged.
    pattern: new RegExp(
      String.raw`import\s+type\s*\{[^}]*\bValidationError\b[^}]*\}\s*from\s*` + RUNTIME_BARREL,
    ),
  },
  {
    id: 'remote-mfe-subpath',
    since: '1.0.0',
    failsAt: '2.0.0',
    adr: 'ADR-056',
    message:
      "`RemoteMFE` has moved off the main runtime barrel to the '/react' subpath, so the barrel no longer pulls React into every bundle",
    fix: "Import it from '@falese/smt-runtime/react'. Everything else on the barrel is unchanged, so a second import line is usually the whole edit. Angular MFEs keep using '@falese/smt-runtime/angular'.",
    // Value imports only. A type-only import erased at compile time and never
    // emitted a require, so it was never broken — flagging it would report
    // code that works.
    pattern: new RegExp(
      String.raw`import\s*\{[^}]*\bRemoteMFE\b[^}]*\}\s*from\s*` + RUNTIME_BARREL,
    ),
    exempt: /import\s+type\s*\{/,
  },
  // Two things ADR-084/085 change in developer-owned files have no entry here,
  // for the same structural reason: migrations are matched line-by-line against
  // files under `src/` with a source extension (see collectSources), so nothing
  // at the MFE root — package.json, tsconfig.json, package-lock.json — can ever
  // be seen by one. Both are detected instead by rules in validateMfeConsistency,
  // which is fed those files directly: `manifest-package-sync` for the framework
  // dependency, `compile-contract-inherited` for the tsconfig extends.
  //
  // No entry for the framework-runtime dependency ADR-084 adds to generated
  // MFEs, deliberately. Migrations are matched only against developer-owned
  // files (see validate.ts), and the import that would signal it lives in
  // generator-owned `slots.tsx` — so such an entry could never fire. The
  // condition is already detected, and *failed* rather than warned, by
  // `manifest-package-sync`: it derives the implied dependencies from the
  // manifest and reports any the package.json is missing. A warning here would
  // be unreachable at best and permanent noise at worst.
  {
    id: 'package-scope-renamed',
    since: '1.0.0',
    failsAt: '2.0.0',
    adr: 'ADR-083',
    message:
      "The platform packages publish as '@falese/smt-*' now; '@seans-mfe/*' and '@seans-mfe-tool/*' resolve nowhere, so `npm install` fails rather than falling back",
    fix: "Rename the specifier — '@seans-mfe-tool/runtime' becomes '@falese/smt-runtime', '@seans-mfe/contracts' becomes '@falese/smt-contracts', and so on — then update the matching entry in this MFE's package.json dependencies. The package's exports are unchanged, so the import list itself does not move.",
    // Any reference to either retired scope, in an import or a package.json
    // dependency line. Deliberately broader than an import statement: a stale
    // dependency entry breaks the install before any import is reached.
    pattern: /@seans-mfe(?:-tool)?\//,
  },
] as const;

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

/**
 * Compare two dotted versions numerically. Returns -1, 0 or 1.
 *
 * Deliberately not `semver`: `packages/codegen` does not depend on it and
 * should not gain a dependency to compare three integers. Prerelease suffixes
 * are ignored rather than ordered — a migration deadline is a release-line
 * decision, and treating `2.0.0-rc.1` as `2.0.0` is the safe reading.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);

  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l > r ? 1 : -1;
  }
  return 0;
}

/**
 * Whether this migration is still advice or has become a requirement, for the
 * platform version currently running.
 *
 * The comparison is against the running CLI, not per-MFE state — there is none
 * to read (ADR-082 Boundaries). The effect is that the escalation arrives when
 * someone upgrades the platform, which is when a breaking change lands anyway.
 */
export function severityFor(
  migration: PlatformMigration,
  platformVersion: string,
): 'warning' | 'error' {
  if (!migration.failsAt) return 'warning';
  return compareVersions(platformVersion, migration.failsAt) >= 0 ? 'error' : 'warning';
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Every line of `source` that uses what `migration` describes. */
export function findMigrationHits(
  migration: PlatformMigration,
  source: SourceLike,
): MigrationHit[] {
  const hits: MigrationHit[] = [];
  const lines = source.text.split(/\r?\n/);

  lines.forEach((text, index) => {
    if (!migration.pattern.test(text)) return;
    if (migration.exempt?.test(text)) return;
    hits.push({ line: index + 1, text: text.trim() });
  });

  return hits;
}
