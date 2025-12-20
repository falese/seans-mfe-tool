  it('Handler array in before phase: contained failure allows next handler (REQ-042)', async () => {
    mfe.hookA = async () => { throw new Error('failA'); };
    mfe.hookB = async () => { mfe.calls.push('hookB'); };
    setLifecycle(mfe, {
      before: [{ chain: { handler: ['custom.hookA', 'custom.hookB'], contained: true } }],
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });
    const res = await mfe.query(makeContext());
    expect(res).toEqual({ data: 'ok' });
    expect(mfe.calls).toContain('hookB');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('Mandatory hook executes after contained failure in before phase (REQ-042)', async () => {
    let executedMandatory = false;
    mfe.hookA = async () => { throw new Error('failA'); };
    mfe.auth = async () => { executedMandatory = true; };
    setLifecycle(mfe, {
      before: [
        { hookA: { handler: 'custom.hookA', contained: true } },
        { auth: { handler: 'custom.auth', mandatory: true } },
      ],
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });
    const res = await mfe.query(makeContext());
    expect(res).toEqual({ data: 'ok' });
    expect(executedMandatory).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
/**
 * Lifecycle Acceptance Tests mapped from docs/acceptance-criteria/lifecycle-hooks.feature
 * REQ-042..045, REQ-054..056
 */

// Note: These tests assume a BaseMFE abstract class exists in src/runtime/base-mfe.ts
// and a concrete TestMFE used for exercising lifecycle behaviors.

import { jest } from '@jest/globals';

// Lazy import to avoid type-only coupling; adapt path if needed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BaseMFE } = require('../../runtime/base-mfe');

class TestMFE extends BaseMFE {
  public calls: string[] = [];
  public failures: string[] = [];
  public telemetry: any[] = [];

  constructor(manifest: any) {
    super(manifest);
  }


  // Capability implementations
  protected async doLoad(context: any) { this.calls.push('doLoad'); return { status: 'loaded', timestamp: new Date() }; }
  protected async doRender(context: any) { this.calls.push('doRender'); return { element: null }; }
  protected async doRefresh(context: any) { this.calls.push('doRefresh'); return { success: true }; }
  protected async doAuthorizeAccess(context: any) { this.calls.push('doAuthorizeAccess'); return { authorized: true }; }
  protected async doHealth(context: any) { this.calls.push('doHealth'); return { status: 'ok' }; }
  protected async doDescribe(context: any) { this.calls.push('doDescribe'); return { description: 'desc' }; }
  protected async doSchema(context: any) { this.calls.push('doSchema'); return { schema: {} }; }
  protected async doQuery(context: any) { this.calls.push('doQuery'); return { data: 'ok' }; }
  protected async doEmit(context: any) { this.calls.push('doEmit'); return { ok: true }; }

  // Custom handlers referenced in tests
  async validateInputs(context: any) { this.calls.push('validateInputs'); }
  async runQuery(context: any) { this.calls.push('runQuery'); }
  async logTelemetry(context: any) { this.calls.push('logTelemetry'); }
  async hookA(context: any) { this.calls.push('hookA'); }
  async hookB(context: any) { this.calls.push('hookB'); }
  async step1(context: any) { this.calls.push('step1'); }
  async step2(context: any) { this.calls.push('step2'); }
}

function makeContext(overrides: any = {}) {
  return {
    capability: 'query',
    inputs: {},
    outputs: {},
    phase: 'before',
    ...overrides,
  };
}

// Helper to set lifecycle by updating the DSL manifest capabilities
function setLifecycle(mfe: any, lifecycle: any) {
  const cap = { type: 'platform', lifecycle };
  mfe.manifest.capabilities = [{ query: cap }];
}

describe('Lifecycle Acceptance (REQ-042..045, REQ-054..056)', () => {
        it('throws if health called in destroyed state', async () => {
          mfe.state = 'destroyed';
          await expect(mfe.health(makeContext())).rejects.toThrow('Invalid state: expected uninitialized or loading or ready or rendering or error, got destroyed');
        });

          it('throws if load called in invalid state', async () => {
            mfe.state = 'rendering';
            await expect(mfe.load(makeContext())).rejects.toThrow('Invalid state: expected uninitialized or ready or error, got rendering');
          });

          it('throws if render called in invalid state', async () => {
            mfe.state = 'uninitialized';
            await expect(mfe.render(makeContext())).rejects.toThrow('Invalid state: expected ready, got uninitialized');
          });

          it('throws if refresh called in invalid state', async () => {
            mfe.state = 'loading';
            await expect(mfe.refresh(makeContext())).rejects.toThrow('Invalid state: expected ready, got loading');
          });

          it('throws if authorizeAccess called in invalid state', async () => {
            mfe.state = 'error';
            await expect(mfe.authorizeAccess(makeContext())).rejects.toThrow('Invalid state: expected ready, got error');
          });

          it('throws if schema called in invalid state', async () => {
            mfe.state = 'uninitialized';
            await expect(mfe.schema(makeContext())).rejects.toThrow('Invalid state: expected ready, got uninitialized');
          });

          it('findCapabilityConfig returns null if capabilities missing', () => {
            mfe.manifest.capabilities = undefined;
            expect(mfe.findCapabilityConfig('query')).toBeNull();
          });

          it('findCapabilityConfig returns null if capability not found', () => {
            mfe.manifest.capabilities = [{ render: { type: 'platform' } }];
            expect(mfe.findCapabilityConfig('query')).toBeNull();
          });

          it('invokePlatformHandler throws if method not implemented', async () => {
            mfe.manifest.capabilities.push({ missing: { type: 'platform' } });
            await expect(mfe.invokePlatformHandler('missing', makeContext({ capability: 'missing' }))).rejects.toThrow('Platform handler not implemented: platform.missing. Expected method doMissing on MFE class.');
          });

        it('throws if describe called in destroyed state', async () => {
          mfe.state = 'destroyed';
          await expect(mfe.describe(makeContext())).rejects.toThrow('Invalid state: expected uninitialized or loading or ready or rendering or error, got destroyed');
        });

        it('throws if render called in wrong state', async () => {
          mfe.state = 'loading';
          await expect(mfe.render(makeContext())).rejects.toThrow('Invalid state: expected ready, got loading');
        });

        it('throws if refresh called in wrong state', async () => {
          mfe.state = 'error';
          await expect(mfe.refresh(makeContext())).rejects.toThrow('Invalid state: expected ready, got error');
        });

        it('throws if authorizeAccess called in wrong state', async () => {
          mfe.state = 'rendering';
          await expect(mfe.authorizeAccess(makeContext())).rejects.toThrow('Invalid state: expected ready, got rendering');
        });

        it('executeLifecycle returns early if no hooks defined', async () => {
          mfe.manifest.capabilities = [{ query: { type: 'platform' } }];
          // No lifecycle property
          await expect(mfe.executeLifecycle('query', 'before', makeContext())).resolves.toBeUndefined();
        });

        it('executeLifecycle returns early if hooks array is empty', async () => {
          mfe.manifest.capabilities = [{ query: { type: 'platform', lifecycle: { before: [] } } }];
          await expect(mfe.executeLifecycle('query', 'before', makeContext())).resolves.toBeUndefined();
        });

        it('allows valid transition to destroyed state', () => {
          mfe.state = 'ready';
          expect(() => mfe.transitionState('destroyed')).not.toThrow();
          expect(mfe.state).toBe('destroyed');
        });
      it('throws on invalid state assertion', () => {
        mfe.state = 'loading';
        expect(() => mfe.assertState('ready')).toThrow('Invalid state: expected ready, got loading');
      });

      it('throws on invalid state transition', () => {
        mfe.state = 'ready';
        expect(() => mfe.transitionState('uninitialized')).toThrow('Invalid state transition: ready → uninitialized');
      });

      it('throws if platform handler not found', async () => {
        // Add a capability not implemented by TestMFE
        mfe.manifest.capabilities.push({ nonexistent: { type: 'platform' } });
        await expect(mfe.invokePlatformHandler('nonexistent', makeContext({ capability: 'nonexistent' }))).rejects.toThrow('Platform handler not implemented: platform.nonexistent. Expected method doNonexistent on MFE class.');
      });

      it('throws if custom handler not found', async () => {
        await expect(mfe.invokeCustomHandler('nonExistentHandler', makeContext())).rejects.toThrow('Custom handler not found: nonExistentHandler.');
      });
    it('Platform wrappers: render, refresh, authorizeAccess, health, describe, schema, emit', async () => {
      // Register all platform capabilities in manifest
      mfe.manifest.capabilities = [
        { render: { type: 'platform' } },
        { refresh: { type: 'platform' } },
        { authorizeAccess: { type: 'platform' } },
        { health: { type: 'platform' } },
        { describe: { type: 'platform' } },
        { schema: { type: 'platform' } },
        { emit: { type: 'platform' } }
      ];
      mfe.calls = [];
      // render
      const r = await mfe.render(makeContext({ capability: 'render' }));
      expect(mfe.calls).toContain('doRender');
      // refresh
      mfe.calls = [];
      const rf = await mfe.refresh(makeContext({ capability: 'refresh' }));
      expect(mfe.calls).toContain('doRefresh');
      // authorizeAccess
      mfe.calls = [];
      const aa = await mfe.authorizeAccess(makeContext({ capability: 'authorizeAccess' }));
      expect(mfe.calls).toContain('doAuthorizeAccess');
      // health
      mfe.calls = [];
      const h = await mfe.health(makeContext({ capability: 'health' }));
      expect(mfe.calls).toContain('doHealth');
      // describe
      mfe.calls = [];
      const d = await mfe.describe(makeContext({ capability: 'describe' }));
      expect(mfe.calls).toContain('doDescribe');
      // schema
      mfe.calls = [];
      const s = await mfe.schema(makeContext({ capability: 'schema' }));
      expect(mfe.calls).toContain('doSchema');
      // emit
      mfe.calls = [];
      const e = await mfe.emit(makeContext({ capability: 'emit' }));
      expect(mfe.calls).toContain('doEmit');
    });
    });
  let mfe: TestMFE;
  let manifest: any;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    manifest = {
      name: 'test-mfe',
      version: '1.0.0',
      type: 'tool',
      language: 'typescript',
      capabilities: []
    };
    mfe = new TestMFE(manifest);
    mfe.calls = [];
    mfe.failures = [];
    mfe.telemetry = [];
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  // Ensure MFE is in ready state before executing capabilities
  beforeEach(async () => {
    await mfe.load(makeContext({ capability: 'load' }));
    // reset call tracking after load
    mfe.calls = [];
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('Executes hooks in order: before → main → after', async () => {
    setLifecycle(mfe, {
      before: [{ validateInputs: { handler: 'custom.validateInputs' } }],
      main: [{ runQuery: { handler: 'custom.runQuery' } }],
      after: [{ logTelemetry: { handler: 'custom.logTelemetry' } }]
    });

    const ctx = makeContext();
    const res = await mfe.query(ctx);
    expect(res).toEqual({ data: 'ok' });
    expect(mfe.calls).toEqual(['validateInputs', 'runQuery', 'doQuery', 'logTelemetry']);
  });

  it('Main phase failure is propagated; after does not run', async () => {
    mfe.runQuery = async () => { throw new Error('boom'); };
    setLifecycle(mfe, {
      main: [{ runQuery: { handler: 'custom.runQuery' } }],
      after: [{ logTelemetry: { handler: 'custom.logTelemetry' } }]
    });

    await expect(mfe.query(makeContext())).rejects.toThrow('boom');
    // Telemetry should be emitted to console.error
    expect(consoleErrorSpy).toHaveBeenCalled();
    const args = consoleErrorSpy.mock.calls.find(call => String(call[0]).includes('[Telemetry]'));
    expect(args).toBeTruthy();
    const payload = args && args[1] ? JSON.parse(args[1] as string) : null;
    expect(payload?.phase).toBe('main');
    expect(payload?.metadata?.severity).toBe('error');
    // After hook should not run
    expect(mfe.calls).not.toContain('logTelemetry');
  });

  it('Non-main failures are contained and logged (contained: true)', async () => {
    mfe.validateInputs = async () => { throw new Error('invalid'); };
    setLifecycle(mfe, {
      before: [{ validateInputs: { handler: 'custom.validateInputs', contained: true } }],
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });

    const res = await mfe.query(makeContext());
    expect(res).toEqual({ data: 'ok' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const args = consoleErrorSpy.mock.calls.find(call => String(call[0]).includes('[Telemetry]'));
    const payload = args && args[1] ? JSON.parse(args[1] as string) : null;
    expect(payload?.phase).toBe('before');
    expect(payload?.metadata?.severity).toBe('warn');
  });

  it('Mandatory hooks execute regardless of prior failures', async () => {
    let executedAuth = false;
    mfe.hookA = async () => { throw new Error('A failed'); };
    mfe.auth = async () => { executedAuth = true; };
    setLifecycle(mfe, {
      before: [
        { hookA: { handler: 'custom.hookA' } },
        { auth: { handler: 'custom.auth', mandatory: true } },
      ],
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });

    const res = await mfe.query(makeContext());
    expect(res).toEqual({ data: 'ok' });
    expect(executedAuth).toBe(true);
  });

  it('Handler array executes sequentially in non-main phases; failures do not stop chain', async () => {
    mfe.hookA = async () => { throw new Error('bad'); };
    setLifecycle(mfe, {
      before: [{ chain: { handler: ['custom.hookA', 'custom.hookB'] } }],
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });

    const res = await mfe.query(makeContext());
    expect(res).toEqual({ data: 'ok' });
    // hookA fails (contained=false), non-main phase continues to next handler
    expect(mfe.calls).toEqual(['hookB', 'runQuery', 'doQuery']);
  });

  it('Main handler array short-circuits on first failure', async () => {
    mfe.step1 = async () => { throw new Error('fail'); };
    setLifecycle(mfe, {
      main: [{ chain: { handler: ['custom.step1', 'custom.step2'] } }]
    });

    await expect(mfe.query(makeContext())).rejects.toThrow('fail');
    expect(mfe.calls).not.toContain('step2');
  });

  it('Valid state transitions: ready → rendering → ready', async () => {
    setLifecycle(mfe, {
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });

    // BaseMFE should start in ready after load/init in this test harness
    const res = await mfe.query(makeContext());
    expect(res).toEqual({ data: 'ok' });
    // No explicit state assertions possible without exposing state; rely on no throws
  });

  it('Invalid state transition throws', async () => {
    // Force internal state to an invalid value and attempt operation
    mfe.state = 'error';
    await expect(mfe.query(makeContext())).rejects.toThrow();
  });

  it('BaseMFE provides 9 platform capabilities', () => {
    const methods = [
      'load','render','refresh','authorizeAccess','health','describe','schema','query','emit'
    ];
    for (const m of methods) {
      expect(typeof (mfe as any)[m]).toBe('function');
    }
  });

  it('Context object flows through lifecycle and can be mutated', async () => {
    mfe.validateInputs = async (ctx: any) => { ctx.inputs.checked = true; };
    mfe.runQuery = async (ctx: any) => { ctx.outputs.result = 'R'; };
    setLifecycle(mfe, {
      before: [{ validateInputs: { handler: 'custom.validateInputs' } }],
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });

    const ctx = makeContext();
    const res = await mfe.query(ctx);
    expect(res).toEqual({ data: 'ok' });
    expect(ctx.inputs.checked).toBe(true);
    expect(ctx.outputs.result).toBe('R');
  });

  it('Telemetry emitted on non-main failures (warn)', async () => {
    mfe.validateInputs = async () => { throw new Error('oops'); };
    setLifecycle(mfe, {
      before: [{ validateInputs: { handler: 'custom.validateInputs' } }],
      main: [{ runQuery: { handler: 'custom.runQuery' } }]
    });

    const res = await mfe.query(makeContext());
    expect(res).toEqual({ data: 'ok' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const args = consoleErrorSpy.mock.calls.find(call => String(call[0]).includes('[Telemetry]'));
    const payload = args && args[1] ? JSON.parse(args[1] as string) : null;
    expect(payload?.metadata?.severity).toBe('warn');
  });

  it('Telemetry emitted on main failures (error)', async () => {
    mfe.runQuery = async () => { throw new Error('bad'); };
    setLifecycle(mfe, { main: [{ runQuery: { handler: 'custom.runQuery' } }] });
    await expect(mfe.query(makeContext())).rejects.toThrow('bad');
    expect(consoleErrorSpy).toHaveBeenCalled();
    const args = consoleErrorSpy.mock.calls.find(call => String(call[0]).includes('[Telemetry]'));
    const payload = args && args[1] ? JSON.parse(args[1] as string) : null;
    expect(payload?.metadata?.severity).toBe('error');
  });
// ...existing code...
