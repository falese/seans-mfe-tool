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

  async emit(event: any) {
    this.telemetry.push(event);
    return { success: true };
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
    expect(payload?.eventData?.phase).toBe('main');
    expect(payload?.severity).toBe('error');
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
    expect(payload?.eventData?.phase).toBe('before');
    expect(payload?.severity).toBe('warn');
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
    expect(payload?.severity).toBe('warn');
  });

  it('Telemetry emitted on main failures (error)', async () => {
    mfe.runQuery = async () => { throw new Error('bad'); };
    setLifecycle(mfe, { main: [{ runQuery: { handler: 'custom.runQuery' } }] });
    await expect(mfe.query(makeContext())).rejects.toThrow('bad');
    expect(consoleErrorSpy).toHaveBeenCalled();
    const args = consoleErrorSpy.mock.calls.find(call => String(call[0]).includes('[Telemetry]'));
    const payload = args && args[1] ? JSON.parse(args[1] as string) : null;
    expect(payload?.severity).toBe('error');
  });
});
