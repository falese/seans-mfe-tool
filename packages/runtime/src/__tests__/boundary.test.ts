/**
 * ADR-056 boundary enforcement — the bright line made machine-checked.
 *
 * The neutral core and the control-plane contract carry ZERO UI-framework
 * surface. Framework knowledge is quarantined in:
 *   • host-side Framework Providers (boundary layer 3), and
 *   • the framework-specialized abstracts (layer 5: RemoteMFE / AngularRemoteMFE),
 * which are deliberately NOT scanned here — they are allowed to import React /
 * Angular precisely because they produce the native handle.
 *
 * If this test fails, framework code has leaked across the waist into a layer
 * that must stay polyglot. Move it into a provider/abstract, don't silence it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

// `from '<framework>'`, `import('<framework>')` or `require('<framework>')`,
// robust to multiline import bodies (the `from '…'` clause is always on one
// line).
//
// The `\s*` before the quote is load-bearing and was missing until #341. Every
// real import writes a space there — `from 'react'`, not `from'react'` — so the
// pattern matched only `require('react')`, a form this codebase does not use.
// The gate could not fail. Proof, if it is ever doubted: the leak it exists to
// stop shipped anyway, and was found by an `ng build` in a generated MFE.
//
// Dynamic `import()` is included for the same reason. `remote-mfe.ts` reaches
// React exclusively through `await import('react')`, so a scan without it is
// blind to the one file in this package that actually imports a framework.
// Bundlers resolve dynamic specifiers statically, so "it is lazy" is not a
// defence — webpack still has to find the module at build time.
//
// `react-dom[^'"]*` rather than `react-dom`: the real specifier is
// `react-dom/client`.
const FRAMEWORK_IMPORT =
  /(?:\bfrom\b|\bimport\s*\(|\brequire\s*\()\s*['"](react|react-dom[^'"]*|@angular\/[^'"]+|vue|svelte|@emotion\/[^'"]+|@mui\/[^'"]+)['"]/;

// Directories that must stay framework-neutral (scanned recursively).
const NEUTRAL_DIRS = ['packages/contracts/src'];

// Individual neutral runtime files: boundary layer 4 (BaseMFE) plus the
// framework-free control-plane core — LayoutManager, BaseControlPlane,
// DaemonChannel, the imperative-handle port, and BaseRemoteMFE (the neutral
// Module Federation lifecycle shared by both framework adapters, ADR-036). The
// contract shapes these depend on now live in the scanned NEUTRAL_DIRS
// (@falese/smt-contracts); the inlined src/runtime/contracts.ts mirror was
// deleted in #236. RemoteMFE / AngularRemoteMFE (layer 5) are intentionally
// excluded: they produce the native handle and are allowed to import React /
// Angular.
const NEUTRAL_FILES = [
  'packages/runtime/src/base-mfe.ts',
  'packages/runtime/src/base-remote-mfe.ts',
  'packages/runtime/src/context.ts',
  'packages/runtime/src/graphql-ws-client.ts',
  'packages/runtime/src/layout-manager.ts',
  'packages/runtime/src/layout-transport.ts',
  'packages/runtime/src/layout-adaptors.ts',
  'packages/runtime/src/base-control-plane.ts',
  'packages/runtime/src/daemon-channel.ts',
  'packages/runtime/src/imperative-handle.ts',
];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

describe('ADR-056 boundary: neutral core + contract carry zero framework imports', () => {
  const targets = [
    ...NEUTRAL_DIRS.flatMap((dir) => tsFiles(join(ROOT, dir))),
    ...NEUTRAL_FILES.map((file) => join(ROOT, file)),
  ];

  it('scans a non-empty set of neutral files', () => {
    expect(targets.length).toBeGreaterThan(0);
  });

  for (const file of targets) {
    const rel = relative(ROOT, file);
    it(`no UI-framework import in ${rel}`, () => {
      const match = readFileSync(file, 'utf8').match(FRAMEWORK_IMPORT);
      // On failure, surface the offending specifier and file.
      expect(match ? `${rel}: imports "${match[1]}"` : null).toBeNull();
    });
  }
});

// ── Barrel reachability ──────────────────────────────────────
//
// The per-file scan above is necessary and was not sufficient. It asks "does
// this file import React", and `RemoteMFE` is *allowed* to — it is layer 5,
// the abstract that produces the native handle. What nothing asked was whether
// the **barrel** reaches it, and it did: `index.ts` re-exported `RemoteMFE`, so
// any value import from '@falese/smt-runtime' pulled React into the bundle.
//
// A type-only import erases at compile time, which is why this hid for so long.
// It surfaced the day a template gained its first *value* import from the
// barrel: three Angular MFEs, which have no React installed, stopped bundling
// with `Can't resolve 'react'` pointing at a runtime file none of their code
// mentions.
//
// So the rule this encodes: **the barrel is polyglot**. Framework-specialized
// abstracts live behind their own subpath ('/react', '/angular') and are
// reachable only by consumers that opted in. Adding a framework-carrying
// re-export to index.ts fails here rather than in someone's `ng build`.

/** Resolve a relative specifier the way tsc would, or null if not local. */
function resolveLocal(spec: string, fromFile: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(join(fromFile, '..'), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
}

/** Every module reachable from `entry` through relative imports, plus how. */
function reachableFrom(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const walk = (file: string, path: string[]): void => {
    if (seen.has(file)) return;
    seen.set(file, path);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:\bfrom\b|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g)) {
      const next = resolveLocal(m[1], file);
      if (next) walk(next, [...path, file]);
    }
  };
  walk(entry, []);
  return seen;
}

describe('ADR-056 boundary: the runtime barrel stays polyglot', () => {
  const barrel = join(ROOT, 'packages/runtime/src/index.ts');

  it('reaches a non-trivial module graph, so a passing result means something', () => {
    expect(reachableFrom(barrel).size).toBeGreaterThan(5);
  });

  it('reaches no module that imports a UI framework', () => {
    const offenders: string[] = [];
    for (const [file, path] of reachableFrom(barrel)) {
      const match = readFileSync(file, 'utf8').match(FRAMEWORK_IMPORT);
      if (!match) continue;
      const trail = [...path, file].map((f) => relative(ROOT, f)).join('\n    → ');
      offenders.push(`imports "${match[1]}" via:\n    → ${trail}`);
    }
    // Printed as a trail rather than a filename: the failure is the *path*,
    // and the fix is to cut one edge of it, not to edit the leaf.
    expect(offenders.join('\n\n') || null).toBeNull();
  });

  it('still exposes the framework abstracts on their own subpaths', () => {
    // The quarantine only works if the specialized entry points exist — this
    // fails if someone "fixes" the test above by deleting the export outright.
    for (const [subpath, expected] of [
      ['react.ts', 'RemoteMFE'],
      ['angular.ts', 'AngularRemoteMFE'],
    ]) {
      const src = readFileSync(join(ROOT, 'packages/runtime/src', subpath), 'utf8');
      expect(src).toContain(expected);
    }
  });
});

// ── Contracts/runtime type boundary ──────────────────────────
//
// The rule: everything that crosses the daemon socket is a contracts type;
// everything internal to the MFE lifecycle engine is a runtime type. A
// runtime source file must therefore not RE-DECLARE a type whose name is
// exported by @falese/smt-contracts — import it (or extend it) instead.
// This is the type-level companion to the framework-import scan above.

/**
 * Known, deliberate exceptions — each carries a reason and should shrink
 * over time, never grow silently:
 *  - ControlPlaneStateResult: the runtime keeps `error` optional for
 *    doUpdateControlPlaneState implementors, while the contracts wire type
 *    requires it. Unify when a breaking change is scheduled (#252, #261).
 *  - ValidationError: the runtime's field-validation *result* interface
 *    (context.ts) predates the contracts ValidationError *error class*;
 *    same name, different concept. Renaming the interface is a public API
 *    break — tracked with the contracts publish (#252).
 */
const ALLOWED_CONTRACT_NAME_MIRRORS = new Set(['ControlPlaneStateResult', 'ValidationError']);

const EXPORT_DECL = /export\s+(?:declare\s+)?(?:abstract\s+)?(?:interface|type|class|enum|const|function)\s+(\w+)/g;
const LOCAL_DECL = /(?:^|\n)\s*(?:export\s+)?(?:abstract\s+)?(?:interface|class|enum)\s+(\w+)|(?:^|\n)\s*(?:export\s+)?type\s+(\w+)\s*=/g;

describe('contracts/runtime type boundary: runtime files do not re-declare contracts exports', () => {
  const contractsExports = new Set<string>();
  for (const file of tsFiles(join(ROOT, 'packages/contracts/src'))) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(EXPORT_DECL)) {
      contractsExports.add(match[1]);
    }
  }

  it('collects a non-empty set of contracts exports', () => {
    expect(contractsExports.size).toBeGreaterThan(0);
  });

  for (const file of tsFiles(join(ROOT, 'packages/runtime/src'))) {
    const rel = relative(ROOT, file);
    it(`no contracts type re-declared in ${rel}`, () => {
      const src = readFileSync(file, 'utf8');
      const offenders: string[] = [];
      for (const match of src.matchAll(LOCAL_DECL)) {
        const name = match[1] ?? match[2];
        if (name && contractsExports.has(name) && !ALLOWED_CONTRACT_NAME_MIRRORS.has(name)) {
          offenders.push(name);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
