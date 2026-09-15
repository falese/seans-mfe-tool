/**
 * Cross-language pin (ADR-096): the Swift rendering of the platform contract
 * cannot drift from the TypeScript one.
 *
 * There is no Swift toolchain in CI, so nothing compiles the emitted package.
 *
 * WHAT THIS SUITE ACTUALLY COVERS, precisely — an earlier version of this
 * docblock overclaimed, and a reviewer caught it:
 *
 *   ✅ TEMPLATE drift. If a template hardcodes a state, mis-renders a
 *      transition target, or drops one half of a capability pair, the
 *      assertions below fail. Verified by mutating the EJS.
 *
 *   ❌ CONTRACT changes, for the assertions that compare the rendering to
 *      `MFE_LIFECYCLE_STATES` / `PLATFORM_CAPABILITIES`. Those are CIRCULAR:
 *      the template renders from the same objects the expectation reads, so
 *      both sides move together. Adding a seventh state was measured to leave
 *      the suite green — and to GROW it, because `it.each([...STATES])`
 *      generates a case per state.
 *
 * Two assertions below are not circular, and they are the ones that carry the
 * "stands in for a compiler" weight:
 *
 *   - `the contract is still the shape the Swift lane was built for` — a frozen
 *     literal, so a contract change fails here and has to be carried into the
 *     Swift lane deliberately rather than flowing through green.
 *   - `every type MFEBase returns is declared in Types.swift` — compares two
 *     independently generated artifacts. This is the one that catches the real
 *     breakage: an added capability whose `resultType` has no entry in
 *     `SWIFT_RESULTS` renders `-> SnapshotResult` against a type nothing
 *     declares, and the package stops compiling.
 *
 * Modeled on `packages/codegen/src/__tests__/platform-contract-pin.test.ts`,
 * which exists for the same reason one level down: codegen once kept its own
 * nine-entry capability map and a manifest declaring the tenth generated
 * nonsense.
 */
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
  MFE_LIFECYCLE_STATES,
  MFE_LIFECYCLE_TRANSITIONS,
  type PlatformCapability,
} from '@seans-mfe/contracts';
import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import { registerSwiftCodegen } from '../codegen';

registerSwiftCodegen();

const basePath = path.join(__dirname, 'output-pin');

/** A manifest declaring every platform capability plus one domain capability. */
function manifestWithEveryPlatformCapability(): DSLManifest {
  return {
    name: 'pin-test',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    endpoint: 'http://localhost:3199',
    capabilities: [
      ...PLATFORM_CAPABILITIES.map((name) => ({
        [PLATFORM_CAPABILITY_SPECS[name].manifestKey]: {
          type: 'platform' as const,
          description: PLATFORM_CAPABILITY_SPECS[name].description,
        },
      })),
      { PlayGame: { type: 'domain' as const, description: 'The one real domain capability' } },
    ],
    targets: { swift: {} },
  } as unknown as DSLManifest;
}

let emitted: Record<string, string>;

beforeAll(async () => {
  const { files } = await generateAllFiles(manifestWithEveryPlatformCapability(), basePath);
  emitted = {};
  for (const f of files) {
    emitted[path.relative(basePath, f.path).split(path.sep).join('/')] = f.content;
  }
});

afterAll(async () => {
  await fs.remove(basePath);
});

const lifecycle = () => emitted['swift/Sources/MFE/Platform/MFELifecycle.swift'];
const base = () => emitted['swift/Sources/MFE/Platform/MFEBase.swift'];

describe('The non-circular assertions', () => {
  // Frozen deliberately. Every other expectation in this file reads the same
  // contract object the template rendered from, so it cannot fail when the
  // contract moves. This one can, and must: the Swift lane was written against
  // exactly these six states and ten capabilities, and a change to either is a
  // change the native lane has to be carried through by hand — a new result
  // type needs a Swift struct and a SWIFT_RESULTS entry, a new state may need
  // a transition in NativeMFEBase.
  //
  // If this fails, do NOT just update the literal. Work out what the Swift
  // lane needs for the new state or capability, then update both.
  const SWIFT_LANE_BUILT_FOR_STATES = [
    'uninitialized', 'loading', 'ready', 'rendering', 'error', 'destroyed',
  ];
  const SWIFT_LANE_BUILT_FOR_CAPABILITIES = [
    'describe', 'load', 'render', 'refresh', 'emit',
    'query', 'schema', 'authorizeAccess', 'health', 'updateControlPlaneState',
  ];

  it('the contract is still the shape the Swift lane was built for', () => {
    expect([...MFE_LIFECYCLE_STATES]).toEqual(SWIFT_LANE_BUILT_FOR_STATES);
    expect([...PLATFORM_CAPABILITIES]).toEqual(SWIFT_LANE_BUILT_FOR_CAPABILITIES);
  });

  it('every type MFEBase returns is declared in Types.swift', () => {
    // The concrete way a contract addition breaks the Swift package:
    // `SWIFT_RESULTS[spec.resultType] ?? spec.resultType` falls through to the
    // TypeScript type name, so a capability whose result type has no Swift
    // mapping emits `-> SnapshotResult` against a type nothing declares.
    // Measured with an 11th capability added: every other assertion in this
    // file stayed green while the emitted package referenced an undeclared
    // type and could not have compiled.
    const types = emitted['swift/Sources/MFE/Platform/Types.swift'];
    const builtIn = ['Void', 'Bool'];
    const returned = [
      ...new Set(
        [...base().matchAll(/func \w+\(_ context: MFEContext\) async throws -> (\w+)/g)]
          .map((m) => m[1]),
      ),
    ];
    expect(returned.length).toBeGreaterThan(0);
    const undeclared = returned.filter(
      (t) => !builtIn.includes(t) && !types.includes(`struct ${t}`),
    );
    expect(undeclared).toEqual([]);
  });
});

describe('MFELifecycle.swift mirrors the platform contract', () => {
  it('declares exactly the contract lifecycle states', () => {
    // Scope to the state enum — the capability enum below it has the same
    // `case x = "x"` shape.
    const body = lifecycle().split('public enum MFELifecycleState')[1].split('}')[0];
    const cases = [...body.matchAll(/case (\w+) = "(\w+)"/g)].map((m) => m[1]);
    expect(cases).toEqual([...MFE_LIFECYCLE_STATES]);
  });

  it('declares exactly the contract capability names', () => {
    const enumBody = lifecycle().split('public enum MFECapability')[1].split('\n\n')[0];
    const cases = [...enumBody.matchAll(/case (\w+) = "(\w+)"/g)].map((m) => m[1]);
    expect(cases).toEqual([...PLATFORM_CAPABILITIES]);
  });

  it.each([...MFE_LIFECYCLE_STATES])('renders the transition edges for %s', (from) => {
    const expected = [...(MFE_LIFECYCLE_TRANSITIONS[from] ?? [])];
    const row = new RegExp(`^\\s+\\.${from}: \\[(.*)\\],$`, 'm').exec(lifecycle());
    expect(row).not.toBeNull();
    const rendered = row![1]
      .split(',')
      .map((s) => s.trim().replace(/^\./, ''))
      .filter(Boolean);
    expect(rendered).toEqual(expected);
  });

  it.each([...PLATFORM_CAPABILITIES])('renders %s preStates from the contract', (name) => {
    const expected = [...PLATFORM_CAPABILITY_SPECS[name as PlatformCapability].preStates];
    const row = new RegExp(`case \\.${name}: return \\[(.*)\\]`).exec(lifecycle());
    expect(row).not.toBeNull();
    const rendered = row![1]
      .split(',')
      .map((s) => s.trim().replace(/^\./, ''))
      .filter(Boolean);
    expect(rendered).toEqual(expected);
  });
});

describe('MFEBase.swift renders BOTH halves of every capability pair', () => {
  // The failure this guards: a capability added to the contract that gains a
  // public entry point but no subclass hook (or the reverse) would leave the
  // native lane half-rendered and still pass a shallow enum check.
  it.each([...PLATFORM_CAPABILITIES])('%s has a public final entry point', (name) => {
    expect(base()).toContain(`public final func ${name}(_ context: MFEContext) async throws`);
  });

  it.each([...PLATFORM_CAPABILITIES])('%s has an open do* hook', (name) => {
    const pascal = name.charAt(0).toUpperCase() + name.slice(1);
    expect(base()).toContain(`open func do${pascal}(_ context: MFEContext) async throws`);
  });

  it('declares no more entry points than the contract has capabilities', () => {
    const finals = [...base().matchAll(/public final func (\w+)\(_ context: MFEContext/g)].map((m) => m[1]);
    expect(finals.sort()).toEqual([...PLATFORM_CAPABILITIES].sort());
  });

  it('makes every capability entry point final — a subclass cannot bypass the guards', () => {
    // `final` is the enforcement TypeScript could only ask for in a comment;
    // if this regresses, the state machine becomes advisory.
    for (const name of PLATFORM_CAPABILITIES) {
      const decl = new RegExp(`func ${name}\\(_ context: MFEContext`).exec(base());
      expect(decl).not.toBeNull();
      const line = base().slice(0, decl!.index).split('\n').pop()! + base().slice(decl!.index).split('\n')[0];
      expect(line).toContain('public final func');
    }
  });

  it('maps void and boolean result types onto Swift spellings', () => {
    expect(base()).toContain('public final func refresh(_ context: MFEContext) async throws -> Void');
    expect(base()).toContain('public final func authorizeAccess(_ context: MFEContext) async throws -> Bool');
  });
});

describe('The concrete class is a third sibling, not a subclass of the web lanes', () => {
  it('descends from NativeMFEBase', () => {
    const generated = emitted['swift/Sources/MFE/Platform/GeneratedMFE.swift'];
    expect(generated).toMatch(/final class \w+MFE: NativeMFEBase/);
  });

  it('NativeMFEBase descends from MFEBase, not from a federation class', () => {
    const native = emitted['swift/Sources/MFE/Platform/NativeMFEBase.swift'];
    expect(native).toContain('open class NativeMFEBase: MFEBase');
  });

  it('declares no getSharedDependencies analogue', () => {
    // The honest asymmetry (ADR-096): a Module Federation shared scope
    // deduplicates singletons across separately-fetched bundles. SPM resolves
    // versions at build time and the linker emits one copy, so there is
    // nothing to negotiate — we declare no member rather than stub one.
    const native = emitted['swift/Sources/MFE/Platform/NativeMFEBase.swift'];
    expect(native).not.toMatch(/func getSharedDependencies/);
  });

  it('acquires the module with Bundle.load(), not a remote entry', () => {
    const native = emitted['swift/Sources/MFE/Platform/NativeMFEBase.swift'];
    expect(native).toContain('func resolveBundle() throws -> Bundle');
    expect(native).toContain('b.load()');
    // No CODE fetches a remote entry. The identifier appears in the header
    // comment explaining the correspondence with BaseRemoteMFE, which is the
    // point of the file — so strip comments before asserting.
    const code = native
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/remoteEntry/i);
    expect(code).not.toMatch(/URLSession|dlopen/);
  });
});
