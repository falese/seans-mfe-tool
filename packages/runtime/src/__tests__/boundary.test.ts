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

// `from '<framework>'` or `require('<framework>')`, robust to multiline import
// bodies (the `from '…'` clause is always on one line).
const FRAMEWORK_IMPORT =
  /(?:from|require\(\s*)['"](react|react-dom|@angular\/[^'"]+|vue|svelte|@emotion\/[^'"]+|@mui\/[^'"]+)['"]/;

// Directories that must stay framework-neutral (scanned recursively).
const NEUTRAL_DIRS = ['packages/contracts/src'];

// Individual neutral runtime files: boundary layer 4 (BaseMFE) plus the
// framework-free control-plane core — LayoutManager, BaseControlPlane,
// DaemonChannel, the imperative-handle port, and BaseRemoteMFE (the neutral
// Module Federation lifecycle shared by both framework adapters, ADR-036). The
// contract shapes these depend on now live in the scanned NEUTRAL_DIRS
// (@seans-mfe/contracts); the inlined src/runtime/contracts.ts mirror was
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

// ── Contracts/runtime type boundary ──────────────────────────
//
// The rule: everything that crosses the daemon socket is a contracts type;
// everything internal to the MFE lifecycle engine is a runtime type. A
// runtime source file must therefore not RE-DECLARE a type whose name is
// exported by @seans-mfe/contracts — import it (or extend it) instead.
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
