/**
 * Every member of `BaseMFE` is either rendered in Swift or knowingly absent.
 *
 * WHY THIS EXISTS. `native-contract-pin.test.ts` asserts one `public final
 * func` and one `open func do…` per platform capability. That is the whole of
 * what any gate checked, so everything else about `BaseMFE` — the lifecycle
 * hook pipeline, the middleware composition, the injected dependencies, the
 * control-plane attachment — was absent from the native lane with nothing
 * reporting it. The gaps were found by reading the two files side by side,
 * which is not a gate.
 *
 * This is NOT circular: it reads `packages/runtime/src/base-mfe.ts` off disk
 * and compares its member names against a committed classification. Adding a
 * member to `BaseMFE` fails this test until someone decides which column it
 * belongs in. That decision is the point — the failure is the prompt to make
 * it, not a chore to silence.
 *
 * It deliberately does not assert that ABSENT is small. Most of these are
 * genuinely out of scope for a first native lane; what was unacceptable was
 * that nobody had to say so.
 */
import * as fs from 'fs';
import * as path from 'path';

const BASE_MFE = path.resolve(__dirname, '../../../runtime/src/base-mfe.ts');

/** Members with a Swift counterpart, and where it lives. */
const RENDERED: Record<string, string> = {
  state: 'MFEBase.state',
  stateHistory: 'MFEBase.stateHistory',
  getState: 'MFEBase.state (a public property, so no accessor is needed)',
  assertState: 'MFEBase.assertState(_:)',
  transitionState: 'MFEBase.transition(to:)',
  executeCapability: 'MFEBase.execute(_:_:_:) — the same eight middlewares, same order (ADR-098 §1)',
  load: 'MFEBase.load(_:)',
  render: 'MFEBase.render(_:)',
  refresh: 'MFEBase.refresh(_:)',
  authorizeAccess: 'MFEBase.authorizeAccess(_:)',
  health: 'MFEBase.health(_:)',
  describe: 'MFEBase.describe(_:)',
  schema: 'MFEBase.schema(_:)',
  query: 'MFEBase.query(_:)',
  emit: 'MFEBase.emit(_:)',
  updateControlPlaneState: 'MFEBase.updateControlPlaneState(_:)',
  executeLifecycle: 'MFEBase.executeLifecycle(_:_:_:)',
  executeHook: 'MFEBase.executeHook(_:_:_:) — containment, propagation, telemetry',
  invokeHandler: 'MFEBase.invokeHandler(_:_:) — the only substitution seam (ADR-079)',
  emitHookFailure: 'MFEBase.emitHookFailure(_:_:_:_:_:)',
  stateGuard: 'MFEBase.stateGuard(_:) — middleware, as in TypeScript',
  stateTransition: 'MFEBase.stateTransition(_:) — middleware',
  lifecyclePhase: 'MFEBase.lifecyclePhase(_:_:) — middleware',
  errorBoundary: 'MFEBase.errorBoundary(_:) — middleware',
  _lifecycleStack: 'MFEBase.lifecycleStack — ADR-001 re-entrancy guard, skips rather than throws',
  deps: 'MFEBase.deps — the four-member native subset (ADR-098 §4)',
  findCapabilityConfig: 'MFEBase.findCapabilityHooks(_:_:) — a static table lookup, not a parse',
  doLoad: 'MFEBase.doLoad(_:) + NativeMFEBase override',
  doRender: 'MFEBase.doRender(_:) + NativeMFEBase override',
  doRefresh: 'MFEBase.doRefresh(_:) + NativeMFEBase override',
  doAuthorizeAccess: 'MFEBase.doAuthorizeAccess(_:) + NativeMFEBase override',
  doHealth: 'MFEBase.doHealth(_:) + NativeMFEBase override',
  doDescribe: 'MFEBase.doDescribe(_:) + NativeMFEBase override',
  doSchema: 'MFEBase.doSchema(_:) + NativeMFEBase override',
  doQuery: 'MFEBase.doQuery(_:) — a concrete default, as in TypeScript (ADR-053/070)',
  doEmit: 'NativeMFEBase.doEmit(_:) — throws MFENotImplementedError, no telemetry transport',
  doUpdateControlPlaneState:
    'NativeMFEBase.doUpdateControlPlaneState(_:) — throws MFENotImplementedError, no control-plane transport',
};

/** Members with NO Swift counterpart, and the reason. */
const ABSENT: Record<string, string> = {
  // Folded into invokeHandler rather than missing: Swift cannot look a method
  // up by name on a plain class, so there is no separate custom-resolution
  // step, and there is no native PLATFORM_HANDLER_LIBRARY to dispatch to
  // (ADR-098 §3 and §Boundaries).
  invokePlatformHandler: 'folded into MFEBase.invokeHandler; no native platform handler library',
  invokeCustomHandler: 'folded into MFEBase.invokeHandler; Swift has no lookup-by-name on a class',
  // Folded into the projection: the CLI flattens phase -> [{hook: config}] into
  // a flat hook list at generation time, so the Swift side has no per-entry
  // iteration step to render (ADR-098 §5).
  executeHookEntry: 'the CLI flattens hook entries into ManifestMetadata.hooks at generation time',
  // Genuinely absent.
  manifest: 'replaced by MFEIdentity + ManifestMetadata, regenerated at swift build time',
  attachControlPlane: 'no native analogue of DaemonWebSocketClient (ADR-096 Boundaries)',
  assertCapabilityImplemented:
    'Swift uses fatalError in the open func default — a crash, not a typed error',
  constructor: 'MFEBase.init(identity:deps:) takes no manifest — ManifestMetadata replaces it',
};

/** Member declarations on the class, skipping locals and object literals. */
function membersOf(source: string): string[] {
  const names = new Set<string>();
  const pattern =
    /^ {2}(?:public |protected |private |readonly |static )*(?:abstract )?(?:async )?(\w+)\s*(?:<[^>]*>)?\s*[(:=]/gm;
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    if (['if', 'for', 'while', 'return', 'switch', 'catch', 'try'].includes(name)) continue;
    names.add(name);
  }
  return [...names].sort();
}

describe('BaseMFE surface vs the Swift rendering', () => {
  const source = fs.readFileSync(BASE_MFE, 'utf8');

  it('reads the real BaseMFE, not a copy', () => {
    // If this file moves, the test must follow it rather than quietly pass.
    expect(fs.existsSync(BASE_MFE)).toBe(true);
    expect(source).toContain('export abstract class BaseMFE');
  });

  it('classifies every member as rendered or knowingly absent', () => {
    const unclassified = membersOf(source).filter(
      (name) => !(name in RENDERED) && !(name in ABSENT),
    );
    // A new BaseMFE member reaches generated Swift or it does not. Either is
    // fine; not having decided is not.
    expect(unclassified).toEqual([]);
  });

  it('classifies nothing that BaseMFE does not have', () => {
    // Guards the other direction: a member renamed or deleted in TypeScript
    // leaves a stale entry here claiming a correspondence that is gone.
    const actual = new Set(membersOf(source));
    const stale = [...Object.keys(RENDERED), ...Object.keys(ABSENT)].filter(
      (name) => !actual.has(name),
    );
    expect(stale).toEqual([]);
  });

  it('claims no member in both columns', () => {
    const both = Object.keys(RENDERED).filter((name) => name in ABSENT);
    expect(both).toEqual([]);
  });

  it('gives every absent member a reason', () => {
    const unexplained = Object.entries(ABSENT).filter(([, reason]) => reason.trim().length < 10);
    expect(unexplained).toEqual([]);
  });
});
