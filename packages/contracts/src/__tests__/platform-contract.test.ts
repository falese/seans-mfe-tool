/**
 * The canonical platform contract (ADR-080): one definition of the ten
 * platform capabilities and the six-state MFE lifecycle machine, consumed by
 * the DSL, the runtime, and codegen instead of re-declared in each.
 *
 * These tests pin the shape and the invariants of the definition itself.
 * The cross-package pins that hold the CONSUMERS to it live next to those
 * consumers (see `platform-contract-pin.test.ts` in runtime and codegen).
 */
import {
  MFE_LIFECYCLE_STATES,
  MFE_LIFECYCLE_INITIAL_STATE,
  MFE_LIFECYCLE_TERMINAL_STATE,
  MFE_LIFECYCLE_TRANSITIONS,
  isMfeLifecycleState,
  isValidLifecycleTransition,
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
  PLATFORM_CAPABILITY_MANIFEST_KEYS,
  PLATFORM_WRAPPER_METHODS,
  isPlatformCapability,
  isPlatformCapabilityManifestKey,
  type MfeLifecycleState,
  type PlatformCapability,
} from '../platform-contract';

describe('MFE lifecycle state machine (ADR-042, single-sourced by ADR-080)', () => {
  it('declares exactly the six states of the contract', () => {
    expect([...MFE_LIFECYCLE_STATES]).toEqual([
      'uninitialized',
      'loading',
      'ready',
      'rendering',
      'error',
      'destroyed',
    ]);
  });

  it('names an initial and a terminal state drawn from that set', () => {
    expect(MFE_LIFECYCLE_INITIAL_STATE).toBe('uninitialized');
    expect(MFE_LIFECYCLE_TERMINAL_STATE).toBe('destroyed');
    expect(MFE_LIFECYCLE_STATES).toContain(MFE_LIFECYCLE_INITIAL_STATE);
    expect(MFE_LIFECYCLE_STATES).toContain(MFE_LIFECYCLE_TERMINAL_STATE);
  });

  it('gives every state a transition row, and every target is a real state', () => {
    for (const state of MFE_LIFECYCLE_STATES) {
      const targets = MFE_LIFECYCLE_TRANSITIONS[state];
      expect(Array.isArray(targets)).toBe(true);
      for (const target of targets) {
        expect(MFE_LIFECYCLE_STATES).toContain(target);
      }
    }
    expect(Object.keys(MFE_LIFECYCLE_TRANSITIONS).sort()).toEqual([...MFE_LIFECYCLE_STATES].sort());
  });

  it('pins the transition table itself — the edges ADR-042 ratified', () => {
    expect(MFE_LIFECYCLE_TRANSITIONS).toEqual({
      uninitialized: ['loading'],
      loading: ['ready', 'error'],
      ready: ['loading', 'rendering', 'destroyed'],
      rendering: ['ready', 'error'],
      error: ['loading', 'destroyed'],
      destroyed: [],
    });
  });

  it('makes the terminal state terminal — nothing leaves destroyed', () => {
    expect(MFE_LIFECYCLE_TRANSITIONS[MFE_LIFECYCLE_TERMINAL_STATE]).toEqual([]);
    for (const state of MFE_LIFECYCLE_STATES) {
      expect(isValidLifecycleTransition(MFE_LIFECYCLE_TERMINAL_STATE, state)).toBe(false);
    }
  });

  it('every state except the initial one is reachable from uninitialized', () => {
    const seen = new Set<MfeLifecycleState>([MFE_LIFECYCLE_INITIAL_STATE]);
    const queue: MfeLifecycleState[] = [MFE_LIFECYCLE_INITIAL_STATE];
    while (queue.length > 0) {
      const next = queue.shift() as MfeLifecycleState;
      for (const target of MFE_LIFECYCLE_TRANSITIONS[next]) {
        if (!seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }
    expect([...seen].sort()).toEqual([...MFE_LIFECYCLE_STATES].sort());
  });

  it('isValidLifecycleTransition answers from the table', () => {
    expect(isValidLifecycleTransition('uninitialized', 'loading')).toBe(true);
    expect(isValidLifecycleTransition('uninitialized', 'ready')).toBe(false);
    expect(isValidLifecycleTransition('ready', 'rendering')).toBe(true);
    expect(isValidLifecycleTransition('rendering', 'destroyed')).toBe(false);
  });

  it('isMfeLifecycleState narrows an unknown string', () => {
    expect(isMfeLifecycleState('ready')).toBe(true);
    expect(isMfeLifecycleState('Ready')).toBe(false);
    expect(isMfeLifecycleState('paused')).toBe(false);
  });
});

describe('The ten platform capabilities (ADR-041, single-sourced by ADR-080)', () => {
  it('declares exactly ten, in the order of docs/PLATFORM-CONTRACT.md', () => {
    expect([...PLATFORM_CAPABILITIES]).toEqual([
      'describe',
      'load',
      'render',
      'refresh',
      'emit',
      'query',
      'schema',
      'authorizeAccess',
      'health',
      'updateControlPlaneState',
    ]);
    expect(PLATFORM_CAPABILITIES).toHaveLength(10);
  });

  it('gives every capability a spec, keyed by its own name', () => {
    expect(Object.keys(PLATFORM_CAPABILITY_SPECS).sort()).toEqual([...PLATFORM_CAPABILITIES].sort());
    for (const name of PLATFORM_CAPABILITIES) {
      expect(PLATFORM_CAPABILITY_SPECS[name].name).toBe(name);
    }
  });

  it('derives the manifest key, wrapper method, and result type from the name', () => {
    const spec = PLATFORM_CAPABILITY_SPECS.updateControlPlaneState;
    expect(spec.manifestKey).toBe('UpdateControlPlaneState');
    expect(spec.wrapperMethod).toBe('doUpdateControlPlaneState');
    expect(spec.resultType).toBe('ControlPlaneStateResult');

    expect(PLATFORM_CAPABILITY_SPECS.authorizeAccess.manifestKey).toBe('AuthorizeAccess');
    expect(PLATFORM_CAPABILITY_SPECS.authorizeAccess.wrapperMethod).toBe('doAuthorizeAccess');
    // The two capabilities whose orchestrator does not return a named result.
    expect(PLATFORM_CAPABILITY_SPECS.refresh.resultType).toBe('void');
    expect(PLATFORM_CAPABILITY_SPECS.authorizeAccess.resultType).toBe('boolean');
  });

  it('pins each capability to the HTTP surface the daemon calls', () => {
    const surface = Object.fromEntries(
      PLATFORM_CAPABILITIES.map((name) => {
        const spec = PLATFORM_CAPABILITY_SPECS[name];
        return [name, `${spec.httpMethod} ${spec.endpoint}`];
      })
    );
    expect(surface).toEqual({
      describe: 'GET /describe',
      load: 'POST /load',
      render: 'POST /render',
      refresh: 'POST /refresh',
      emit: 'POST /emit',
      query: 'POST /query',
      schema: 'GET /schema',
      authorizeAccess: 'POST /authorize',
      health: 'GET /health',
      updateControlPlaneState: 'POST /state',
    });
  });

  it('states every capability’s relationship to the lifecycle machine', () => {
    for (const name of PLATFORM_CAPABILITIES) {
      const spec = PLATFORM_CAPABILITY_SPECS[name];
      for (const state of spec.preStates) {
        expect(MFE_LIFECYCLE_STATES).toContain(state);
      }
      for (const state of [spec.enterState, spec.exitState, spec.errorState]) {
        if (state !== undefined) expect(MFE_LIFECYCLE_STATES).toContain(state);
      }
    }
  });

  it('every state transition a capability declares is legal in the table', () => {
    for (const name of PLATFORM_CAPABILITIES) {
      const { preStates, enterState, exitState, errorState } = PLATFORM_CAPABILITY_SPECS[name];
      if (enterState) {
        for (const from of preStates) {
          if (from === enterState) continue;
          expect(isValidLifecycleTransition(from, enterState)).toBe(true);
        }
        for (const to of [exitState, errorState]) {
          if (to) expect(isValidLifecycleTransition(enterState, to)).toBe(true);
        }
      }
    }
  });

  it('pins load and render as the two state-advancing capabilities', () => {
    expect(PLATFORM_CAPABILITY_SPECS.load).toMatchObject({
      preStates: ['uninitialized', 'ready', 'error'],
      enterState: 'loading',
      exitState: 'ready',
      errorState: 'error',
    });
    expect(PLATFORM_CAPABILITY_SPECS.render).toMatchObject({
      preStates: ['ready'],
      enterState: 'rendering',
      exitState: 'ready',
      errorState: 'error',
    });
  });

  it('emit is callable from any state; health and describe from any live state', () => {
    expect(PLATFORM_CAPABILITY_SPECS.emit.preStates).toEqual([]);
    for (const name of ['health', 'describe'] as const) {
      expect([...PLATFORM_CAPABILITY_SPECS[name].preStates]).toEqual([
        'uninitialized',
        'loading',
        'ready',
        'rendering',
        'error',
      ]);
      expect(PLATFORM_CAPABILITY_SPECS[name].preStates).not.toContain(MFE_LIFECYCLE_TERMINAL_STATE);
    }
  });

  it('exposes the wrapper methods the DSL forbids as handler references', () => {
    expect([...PLATFORM_WRAPPER_METHODS].sort()).toEqual(
      PLATFORM_CAPABILITIES.map((name) => PLATFORM_CAPABILITY_SPECS[name].wrapperMethod).sort()
    );
    expect(PLATFORM_WRAPPER_METHODS).toContain('doUpdateControlPlaneState');
  });

  it('exposes both spellings a manifest may use as a capability entry key', () => {
    expect([...PLATFORM_CAPABILITY_MANIFEST_KEYS].sort()).toEqual(
      [
        ...PLATFORM_CAPABILITIES,
        ...PLATFORM_CAPABILITIES.map((name) => PLATFORM_CAPABILITY_SPECS[name].manifestKey),
      ].sort()
    );
    expect(PLATFORM_CAPABILITY_MANIFEST_KEYS).toHaveLength(20);
  });

  it('isPlatformCapability narrows the camelCase name only', () => {
    expect(isPlatformCapability('updateControlPlaneState')).toBe(true);
    expect(isPlatformCapability('UpdateControlPlaneState')).toBe(false);
    expect(isPlatformCapability('PlayGame')).toBe(false);
  });

  it('isPlatformCapabilityManifestKey accepts either spelling — domain names never', () => {
    for (const key of ['load', 'Load', 'updateControlPlaneState', 'UpdateControlPlaneState']) {
      expect(isPlatformCapabilityManifestKey(key)).toBe(true);
    }
    for (const key of ['PlayGame', 'ShowCover', 'loading', 'doLoad']) {
      expect(isPlatformCapabilityManifestKey(key)).toBe(false);
    }
  });
});

describe('the definition is data, not behavior', () => {
  it('is frozen — a consumer cannot mutate the shared contract', () => {
    expect(Object.isFrozen(PLATFORM_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(MFE_LIFECYCLE_STATES)).toBe(true);
    expect(Object.isFrozen(MFE_LIFECYCLE_TRANSITIONS)).toBe(true);
    expect(Object.isFrozen(PLATFORM_CAPABILITY_SPECS)).toBe(true);
    for (const name of PLATFORM_CAPABILITIES) {
      expect(Object.isFrozen(PLATFORM_CAPABILITY_SPECS[name])).toBe(true);
      expect(Object.isFrozen(PLATFORM_CAPABILITY_SPECS[name].preStates)).toBe(true);
    }
    for (const state of MFE_LIFECYCLE_STATES) {
      expect(Object.isFrozen(MFE_LIFECYCLE_TRANSITIONS[state])).toBe(true);
    }
  });

  it('type-level: PlatformCapability is the union of the ten names', () => {
    const name: PlatformCapability = 'render';
    expect(PLATFORM_CAPABILITIES).toContain(name);
  });
});
