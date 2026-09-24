/**
 * The Rust rendering of the platform contract (ADR-099).
 *
 * Most assertions that compare the rendering to `@seans-mfe/contracts` are
 * circular — the template renders from the same objects they read — so they
 * catch TEMPLATE drift and nothing else (ADR-096 §Boundaries). The first
 * describe block holds the two that are not.
 */
import * as path from 'path';
import { generateAllFiles } from '@seans-mfe/codegen';
import { MFE_LIFECYCLE_STATES, PLATFORM_CAPABILITIES, PLATFORM_CAPABILITY_SPECS } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';
import { registerRustCodegen, pascalCase, snakeCase } from '../codegen';

registerRustCodegen();

const basePath = path.join(__dirname, 'output-pin');
const emitted: Record<string, string> = {};

beforeAll(async () => {
  const manifest = {
    name: 'crew-services',
    version: '1.0.0',
    type: 'remote',
    capabilities: [{ CrewRoster: { type: 'domain', description: 'Crew roster' } }],
    targets: { rust: {} },
  } as unknown as DSLManifest;
  const { files } = await generateAllFiles(manifest, basePath);
  for (const f of files) emitted[path.relative(basePath, f.path).split(path.sep).join('/')] = f.content;
});

const lifecycle = () => emitted['rust/src/platform/mfe_lifecycle.rs'];
const base = () => emitted['rust/src/platform/mfe_base.rs'];

describe('The non-circular assertions', () => {
  // Frozen deliberately. If this fails, do NOT just update the literal: work
  // out what the Rust lane needs for the new state or capability — a result
  // struct in types.rs, a RUST_RESULTS entry, a native do_* default — then
  // update both.
  const RUST_LANE_BUILT_FOR_STATES = ['uninitialized', 'loading', 'ready', 'rendering', 'error', 'destroyed'];
  const RUST_LANE_BUILT_FOR_CAPABILITIES = [
    'describe', 'load', 'render', 'refresh', 'emit',
    'query', 'schema', 'authorizeAccess', 'health', 'updateControlPlaneState',
  ];

  it('the contract is still the shape the Rust lane was built for', () => {
    expect([...MFE_LIFECYCLE_STATES]).toEqual(RUST_LANE_BUILT_FOR_STATES);
    expect([...PLATFORM_CAPABILITIES]).toEqual(RUST_LANE_BUILT_FOR_CAPABILITIES);
  });

  it('every type a capability returns is declared in types.rs', () => {
    // A capability whose resultType has no RUST_RESULTS entry falls through
    // to the TypeScript type name — `Result<SnapshotResult, MfeError>` against
    // a struct nothing declares. Compares two independently generated files.
    const types = emitted['rust/src/platform/types.rs'];
    const builtIn = ['()', 'bool'];
    const returned = [
      ...new Set([...base().matchAll(/pub async fn \w+\(&self, context: MfeContext\) -> Result<([^,]+), MfeError>/g)].map((m) => m[1])),
    ];
    expect(returned).toHaveLength(new Set(PLATFORM_CAPABILITIES.map((c) => PLATFORM_CAPABILITY_SPECS[c].resultType)).size);
    const undeclared = returned.filter((t) => !builtIn.includes(t) && !types.includes(`pub struct ${t} {`));
    expect(undeclared).toEqual([]);
  });
});

describe('mfe_lifecycle.rs mirrors the platform contract', () => {
  it('declares exactly the contract lifecycle states', () => {
    const body = lifecycle().split('pub enum MfeLifecycleState {')[1].split('}')[0];
    const variants = body.split(',').map((s) => s.trim()).filter(Boolean);
    expect(variants).toEqual(MFE_LIFECYCLE_STATES.map(pascalCase));
  });

  it('spells every state the way the contract does', () => {
    for (const s of MFE_LIFECYCLE_STATES) {
      expect(lifecycle()).toContain(`MfeLifecycleState::${pascalCase(s)} => "${s}",`);
    }
  });

  it('spells every capability the way the contract does', () => {
    for (const c of PLATFORM_CAPABILITIES) {
      expect(lifecycle()).toContain(`MfeCapability::${c.charAt(0).toUpperCase() + c.slice(1)} => "${c}",`);
    }
  });

  it('renders emit as the one capability with no pre-states', () => {
    expect(lifecycle()).toContain('MfeCapability::Emit => &[],');
  });
});

describe('mfe_base.rs renders both halves of every capability', () => {
  it.each([...PLATFORM_CAPABILITIES])('%s has an entry point and a hook', (c) => {
    const snake = snakeCase(c);
    expect(base()).toContain(`pub async fn ${snake}(&self, context: MfeContext)`);
    expect(base()).toContain(`fn do_${snake}<'a>(&'a self, core: &'a MfeCore, context: &'a MfeContext)`);
  });

  it('gives do_query — and only do_query — a default, at the layer TypeScript does', () => {
    const hooks = base().split('pub trait MfeHooks: Send + Sync {')[1].split('\n}\n')[0];
    const withBody = [...hooks.matchAll(/fn (do_\w+)<'a>[^;{]*\{/g)].map((m) => m[1]);
    expect(withBody).toEqual(['do_query']);
  });

  it('composes the pipeline in executeCapability\'s order', () => {
    const exec = base().split('async fn execute<')[1];
    const order = [
      'self.assert_state(capability',
      'capability.enter_state()',
      'self.guarded(capability',
    ].map((needle) => exec.indexOf(needle));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    const guarded = base().split('async fn guarded<')[1];
    const inner = [
      'MfeLifecyclePhase::Before',
      'MfeLifecyclePhase::Main',
      'body(body_context)',
      'MfeLifecyclePhase::After',
      'capability.exit_state()',
    ].map((needle) => guarded.indexOf(needle));
    expect(inner.every((i) => i >= 0)).toBe(true);
    expect([...inner].sort((a, b) => a - b)).toEqual(inner);
  });

  it('looks hooks up case-insensitively — the Swift lane\'s inert-hooks defect', () => {
    expect(base()).toContain('h.capability.eq_ignore_ascii_case(capability)');
  });
});

describe('The native layer', () => {
  const native = () => emitted['rust/src/platform/native_mfe_base.rs'];

  it('declares no shared-dependency analogue (ADR-096 §4)', () => {
    expect(native()).not.toMatch(/fn \w*shared/i);
  });

  it('fails emit and updateControlPlaneState rather than claiming success', () => {
    expect(native()).toContain('capability: MfeCapability::Emit,');
    expect(native()).toContain('capability: MfeCapability::UpdateControlPlaneState,');
    expect(native()).not.toMatch(/(EmitResult|ControlPlaneStateResult) \{\s*accepted/);
  });
});
