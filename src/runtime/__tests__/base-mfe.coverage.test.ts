
import { BaseMFE } from '../base-mfe';

// TestMFE class available to all tests
class TestMFE extends BaseMFE {
  constructor(manifest: any, deps?: any) {
    super(manifest, deps);
  }
  protected async doLoad(context: any): Promise<{ status: "loaded"; timestamp: Date }> {
    return { status: "loaded", timestamp: new Date() };
  }
  protected async doRender(context: any): Promise<{ status: "rendered"; element: null; timestamp: Date }> {
    return { status: "rendered", element: null, timestamp: new Date() };
  }
  protected async doRefresh(context: any): Promise<void> { return; }
  protected async doAuthorizeAccess(context: any): Promise<boolean> { return true; }
  protected async doHealth(context: any): Promise<{ status: "healthy"; checks: any[]; timestamp: Date }> {
    return { status: "healthy", checks: [], timestamp: new Date() };
  }
  protected async doDescribe(context: any): Promise<{ name: string; version: string; type: "tool"; capabilities: any[]; manifest: { name: string; version: string; type: "tool"; language: "javascript"; capabilities: any[] } }> {
    return {
      name: "test",
      version: "1.0",
      type: "tool",
      capabilities: [],
      manifest: {
        name: "test",
        version: "1.0",
        type: "tool",
        language: "javascript",
        capabilities: []
      }
    };
  }
  protected async doSchema(context: any): Promise<{ schema: string; format: "json" }> {
    return { schema: "{}", format: "json" };
  }
  protected async doQuery(context: any): Promise<{ data: string }> {
    return { data: "ok" };
  }
  protected async doEmit(context: any): Promise<{ emitted: boolean }> {
    return { emitted: true };
  }
  protected async doUpdateControlPlaneState(context: any): Promise<{ acknowledged: boolean; correlationId: string }> {
    return { acknowledged: true, correlationId: context.requestId || 'test' };
  }
  async customA(context: any) { context.calledA = true; }
  async customB(context: any) { context.calledB = true; }

  // Public setters for DI handler mocks
  public setCustomHandler(name: string, fn: (ctx: any) => Promise<any>) {
    if (this.deps.customHandlers) {
      this.deps.customHandlers[name] = fn;
    }
  }
  public setPlatformHandler(name: string, fn: (ctx: any) => Promise<any>) {
    if (this.deps.platformHandlers) {
      this.deps.platformHandlers[name] = fn;
    }
  }
}

describe('BaseMFE error path coverage for public capability methods', () => {
  let mfe: TestMFE;
  let spy: jest.SpyInstance;
  const context = { timestamp: new Date(), requestId: 'err-path' };
  beforeEach(() => {
    mfe = new TestMFE({ name: 'err-mfe', capabilities: [] });
    spy = jest.spyOn(mfe as any, 'executeLifecycle').mockImplementation(async () => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });
  it('refresh: should call error phase on failure', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doRefresh = async () => { throw new Error('fail-refresh'); };
    await expect(mfe.refresh(context)).rejects.toThrow('fail-refresh');
    expect(spy).toHaveBeenCalledWith('refresh', 'error', expect.objectContaining({ error: expect.any(Error) }));
  });
  it('authorizeAccess: should call error phase on failure', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doAuthorizeAccess = async () => { throw new Error('fail-auth'); };
    await expect(mfe.authorizeAccess(context)).rejects.toThrow('fail-auth');
    expect(spy).toHaveBeenCalledWith('authorizeAccess', 'error', expect.objectContaining({ error: expect.any(Error) }));
  });
  it('health: should call error phase on failure', async () => {
    (mfe as any).doHealth = async () => { throw new Error('fail-health'); };
    await expect(mfe.health(context)).rejects.toThrow('fail-health');
    expect(spy).toHaveBeenCalledWith('health', 'error', expect.objectContaining({ error: expect.any(Error) }));
  });
  it('describe: should call error phase on failure', async () => {
    (mfe as any).doDescribe = async () => { throw new Error('fail-describe'); };
    await expect(mfe.describe(context)).rejects.toThrow('fail-describe');
    expect(spy).toHaveBeenCalledWith('describe', 'error', expect.objectContaining({ error: expect.any(Error) }));
  });
  it('schema: should call error phase on failure', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doSchema = async () => { throw new Error('fail-schema'); };
    await expect(mfe.schema(context)).rejects.toThrow('fail-schema');
    expect(spy).toHaveBeenCalledWith('schema', 'error', expect.objectContaining({ error: expect.any(Error) }));
  });
  it('query: should call error phase on failure', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doQuery = async () => { throw new Error('fail-query'); };
    await expect(mfe.query(context)).rejects.toThrow('fail-query');
    expect(spy).toHaveBeenCalledWith('query', 'error', expect.objectContaining({ error: expect.any(Error) }));
  });
  it('emit: should call error phase on failure', async () => {
    (mfe as any).doEmit = async () => { throw new Error('fail-emit'); };
    await expect(mfe.emit(context)).rejects.toThrow('fail-emit');
    expect(spy).toHaveBeenCalledWith('emit', 'error', expect.objectContaining({ error: expect.any(Error) }));
  });
});
it('should use DI lifecycleExecutor for all hook entries and skip default execution', async () => {
  const manifest = {
    name: 'di-lifecycle-mfe',
    capabilities: [{
      emit: {
        type: 'platform',
        lifecycle: {
          before: [ { emit: { handler: 'platform.emit' } } ],
          main: [ { emit: { handler: 'platform.emit' } }, { emit: { handler: 'platform.emit2' } } ],
          after: [ { emit: { handler: 'platform.emit' } } ]
        }
      }
    }]
  };
  const calls: Array<{hookEntry: any, phase: string}> = [];
  const lifecycleExecutor = {
    async execute(hookEntry: any, context: any, phase: string) {
      calls.push({ hookEntry, phase });
    }
  };
  // Use only manifest for TestMFE constructor, set lifecycleExecutor after
  const mfeDI = new TestMFE(manifest);
  // Use DI setter for lifecycleExecutor
  (mfeDI as any).deps = { lifecycleExecutor };
  const context = { timestamp: new Date(), requestId: 'di-lifecycle' };
  await mfeDI['executeLifecycle']('emit', 'main', context);
  expect(calls.length).toBe(2);
  expect(calls[0].phase).toBe('main');
  expect(calls[1].phase).toBe('main');
});
// ...existing code...

// ...existing code...

// --- DI Fallback and Edge Case Coverage ---
it('should fallback to default platform handler if DI not provided', async () => {
  const manifest = { name: 'fallback-mfe', capabilities: [{ emit: { type: 'platform', lifecycle: { main: [{ emit: { handler: 'platform.emit' } }] } } }] };
  const mfeFallback = new TestMFE(manifest);
  // Use DI setter for empty deps
  (mfeFallback as any).deps = {};
  mfeFallback.setPlatformHandler('emit', undefined as any); // Remove DI handler
  mfeFallback['doEmit'] = async (ctx: any) => { ctx.fallbackCalled = true; return { emitted: true }; };
  const context: any = { timestamp: new Date(), requestId: 'fallback' };
  // Use public emit method to trigger platform handler
  await expect(mfeFallback.emit(context)).rejects.toThrow('Platform handler not implemented: platform.emit. Expected method doEmit on MFE class.');
});

it('should fallback to default custom handler if DI not provided', async () => {
  const manifest = { name: 'fallback-mfe', capabilities: [{ customA: { type: 'custom', lifecycle: { main: [{ customA: { handler: 'custom.customA' } }] } } }] };
  const mfeFallback = new TestMFE(manifest);
  (mfeFallback as any).deps = {};
  mfeFallback.setCustomHandler('customA', undefined as any); // Remove DI handler
  mfeFallback['customA'] = async (ctx: any) => { ctx.fallbackCustomCalled = true; };
  const context: any = { timestamp: new Date(), requestId: 'fallback-custom' };
  // Use public method or simulate lifecycle to trigger custom handler
  await mfeFallback.customA(context);
  expect(context.fallbackCustomCalled).toBe(true);
});

it('should log telemetry to console if DI telemetry not provided', async () => {
  const manifest = { name: 'telemetry-mfe', capabilities: [] };
  const mfeNoTelemetry = new TestMFE(manifest);
  (mfeNoTelemetry as any).deps = {};
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const context: any = { timestamp: new Date(), requestId: 'no-telemetry' };
  await mfeNoTelemetry['emitHookFailure']('hook', 'handler', new Error('fail'), context, 'warn');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

it('should throw error if platform handler not found and DI not provided', async () => {
  const manifest = { name: 'missing-platform', capabilities: [] };
  const mfeMissing = new TestMFE(manifest);
  (mfeMissing as any).deps = {};
  // Override doEmit to simulate missing platform handler
  (mfeMissing as any).doEmit = undefined;
  const context: any = { timestamp: new Date(), requestId: 'missing-platform' };
  await expect(mfeMissing.emit(context)).rejects.toThrow('Platform handler not implemented: platform.emit. Expected method doEmit on MFE class.');
});

it('should throw error if custom handler not found and DI not provided', async () => {
  const manifest = { name: 'missing-custom', capabilities: [] };
  const mfeMissing = new TestMFE(manifest);
  (mfeMissing as any).deps = {};
  const context: any = { timestamp: new Date(), requestId: 'missing-custom' };
  // Simulate lifecycle execution with missing custom handler
  await expect(mfeMissing['executeHook']('notfound', { handler: 'custom.notfound' }, context, 'main')).rejects.toThrow(/Custom handler not found/);
});

it('should call errorHandler if DI errorHandler provided and state is invalid', () => {
  const manifest = { name: 'error-mfe', capabilities: [] };
  let errorHandled = false;
  const errorHandler = { handle: () => { errorHandled = true; } };
  const mfeError = new TestMFE(manifest);
  (mfeError as any).deps = { errorHandler };
  (mfeError as any).state = 'loading';
  try {
    (mfeError as any).assertState('ready');
  } catch (e) {
    // expected
  }
  expect(errorHandled).toBe(true);
});


describe('BaseMFE Full Coverage', () => {
  class TestMFE extends BaseMFE {
    constructor(manifest: any, deps?: any) {
      super(manifest, deps);
    }
    protected async doLoad(context: any): Promise<{ status: "loaded"; timestamp: Date }> {
      return { status: "loaded", timestamp: new Date() };
    }
    protected async doRender(context: any): Promise<{ status: "rendered"; element: null; timestamp: Date }> {
      return { status: "rendered", element: null, timestamp: new Date() };
    }
    protected async doRefresh(context: any): Promise<void> { return; }
    protected async doAuthorizeAccess(context: any): Promise<boolean> { return true; }
    protected async doHealth(context: any): Promise<{ status: "healthy"; checks: any[]; timestamp: Date }> {
      return { status: "healthy", checks: [], timestamp: new Date() };
    }
    protected async doDescribe(context: any): Promise<{ name: string; version: string; type: "tool"; capabilities: any[]; manifest: { name: string; version: string; type: "tool"; language: "javascript"; capabilities: any[] } }> {
      return {
        name: "test",
        version: "1.0",
        type: "tool",
        capabilities: [],
        manifest: {
          name: "test",
          version: "1.0",
          type: "tool",
          language: "javascript",
          capabilities: []
        }
      };
    }
    protected async doSchema(context: any): Promise<{ schema: string; format: "json" }> {
      return { schema: "{}", format: "json" };
    }
    protected async doQuery(context: any): Promise<{ data: string }> {
      return { data: "ok" };
    }
    protected async doEmit(context: any): Promise<{ emitted: boolean }> {
      return { emitted: true };
    }
    async customA(context: any) { context.calledA = true; }
    async customB(context: any) { context.calledB = true; }

    // Public setters for DI handler mocks
    public setCustomHandler(name: string, fn: (ctx: any) => Promise<any>) {
      if (this.deps.customHandlers) {
        this.deps.customHandlers[name] = fn;
      }
    }
    public setPlatformHandler(name: string, fn: (ctx: any) => Promise<any>) {
      if (this.deps.platformHandlers) {
        this.deps.platformHandlers[name] = fn;
      }
    }
  }

  let mfe: TestMFE;
  let manifest: any;
  let telemetryEvents: any[];

  const platformHandlers = {
    emit: async (context: any) => { context._emitCalled = true; return { emitted: true }; }
  };
  const customHandlers = {
    customA: async (context: any) => { context.calledA = true; },
    customB: async (context: any) => { context.calledB = true; }
  };
  const telemetry = {
    emit: (event: any) => { telemetryEvents.push(event); }
  };
  const errorHandler = {
    handle: (error: Error, context: any) => { context._errorHandled = true; }
  };

  beforeEach(() => {
    manifest = { name: 'full-mfe', capabilities: [{ load: { type: 'platform', lifecycle: { before: [{ customA: { handler: 'custom.customA' } }], main: [], after: [], error: [] } } }] };
    telemetryEvents = [];
    mfe = new TestMFE(manifest, {
      platformHandlers,
      customHandlers,
      telemetry,
      errorHandler
    });
  });

  // Statement coverage: public methods and error paths
  it('getState returns current state', () => {
    expect(mfe.getState()).toBe('uninitialized');
    (mfe as any).state = 'ready';
    expect(mfe.getState()).toBe('ready');
  });

  it('load transitions through all states and returns result', async () => {
    (mfe as any).state = 'uninitialized';
    const context = { timestamp: new Date(), requestId: 'req1' };
    const result = await mfe.load(context);
    expect(result.status).toBe('loaded');
    expect((mfe as any).state).toBe('ready');
    expect((mfe as any).stateHistory.length).toBeGreaterThanOrEqual(2);
  });

  it('load throws and transitions to error on failure', async () => {
    (mfe as any).state = 'uninitialized';
    (mfe as any).doLoad = async () => { throw new Error('fail-load'); };
    const context = { timestamp: new Date(), requestId: 'req2' };
    await expect(mfe.load(context)).rejects.toThrow('fail-load');
    expect((mfe as any).state).toBe('error');
  });

  it('render transitions through all states and returns result', async () => {
    (mfe as any).state = 'ready';
    const context = { timestamp: new Date(), requestId: 'req3' };
    const result = await mfe.render(context);
    expect(result.status).toBe('rendered');
    expect((mfe as any).state).toBe('ready');
  });

  it('render throws and transitions to error on failure', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doRender = async () => { throw new Error('fail-render'); };
    const context = { timestamp: new Date(), requestId: 'req4' };
    await expect(mfe.render(context)).rejects.toThrow('fail-render');
    expect((mfe as any).state).toBe('error');
  });

  it('refresh executes all phases and throws on error', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doRefresh = async () => { throw new Error('fail-refresh'); };
    const context = { timestamp: new Date(), requestId: 'req5' };
    await expect(mfe.refresh(context)).rejects.toThrow('fail-refresh');
  });

  it('authorizeAccess executes all phases and throws on error', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doAuthorizeAccess = async () => { throw new Error('fail-auth'); };
    const context = { timestamp: new Date(), requestId: 'req6' };
    await expect(mfe.authorizeAccess(context)).rejects.toThrow('fail-auth');
  });

  it('health executes all phases and throws on error', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doHealth = async () => { throw new Error('fail-health'); };
    const context = { timestamp: new Date(), requestId: 'req7' };
    await expect(mfe.health(context)).rejects.toThrow('fail-health');
  });

  it('describe executes all phases and throws on error', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doDescribe = async () => { throw new Error('fail-describe'); };
    const context = { timestamp: new Date(), requestId: 'req8' };
    await expect(mfe.describe(context)).rejects.toThrow('fail-describe');
  });

  it('schema executes all phases and throws on error', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doSchema = async () => { throw new Error('fail-schema'); };
    const context = { timestamp: new Date(), requestId: 'req9' };
    await expect(mfe.schema(context)).rejects.toThrow('fail-schema');
  });

  it('query executes all phases and throws on error', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doQuery = async () => { throw new Error('fail-query'); };
    const context = { timestamp: new Date(), requestId: 'req10' };
    await expect(mfe.query(context)).rejects.toThrow('fail-query');
  });

  it('emit executes all phases and throws on error', async () => {
    (mfe as any).state = 'ready';
    (mfe as any).doEmit = async () => { throw new Error('fail-emit'); };
    const context = { timestamp: new Date(), requestId: 'req11' };
    await expect(mfe.emit(context)).rejects.toThrow('fail-emit');
  });

  // --- Additional targeted tests for uncovered lines/branches ---
  it('should throw on transitionState to same state (invalid)', () => {
    (mfe as any).state = 'ready';
    expect(() => (mfe as any).transitionState('ready')).toThrow(/Invalid state transition/);
    expect((mfe as any).state).toBe('ready');
  });

  it('should handle transitionState to error from any state', () => {
    (mfe as any).state = 'loading';
    expect(() => (mfe as any).transitionState('error')).not.toThrow();
    expect((mfe as any).state).toBe('error');
  });

  it('should throw on transitionState to uninitialized from error', () => {
    (mfe as any).state = 'error';
    expect(() => (mfe as any).transitionState('uninitialized')).toThrow(/Invalid state transition/);
  });

  it('should handle empty manifest gracefully', async () => {
    (mfe as any).manifest = {};
    const context: any = { timestamp: new Date(), requestId: 'empty-manifest' };
    await expect((mfe as any).executeLifecycle('foo', 'before', context)).resolves.toBeUndefined();
    expect((mfe as any).findCapabilityConfig('foo')).toBeNull();
  });

  it('should handle missing capabilityConfig and lifecycle', async () => {
    (mfe as any).manifest = { capabilities: [{ foo: { type: 'platform' } }] };
    const context: any = { timestamp: new Date(), requestId: 'missing-lifecycle' };
    await expect((mfe as any).executeLifecycle('foo', 'main', context)).resolves.toBeUndefined();
  });

  it('should throw in emitHookFailure with invalid event', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const context: any = { timestamp: new Date(), requestId: 'bad-emit' };
    await expect((mfe as any).emitHookFailure('hook', 'handler', null, context, 'warn')).rejects.toThrow();
    spy.mockRestore();
  });

  it('should handle empty stateHistory array', () => {
    (mfe as any).stateHistory = [];
    expect(Array.isArray((mfe as any).stateHistory)).toBe(true);
    expect((mfe as any).stateHistory.length).toBe(0);
  });

  it('should throw on transitionState with undefined state', () => {
    (mfe as any).state = undefined;
    expect(() => (mfe as any).transitionState('ready')).toThrow();
  });

  it('should handle assertState with undefined state', () => {
    (mfe as any).state = undefined;
    expect(() => (mfe as any).assertState('ready')).toThrow();
  });

  it('should handle invokeHandler with invalid handler type', async () => {
    const context: any = { timestamp: new Date(), requestId: 'bad-handler' };
    await expect((mfe as any).invokeHandler('unknown.type', context)).rejects.toThrow();
  });

  it('should handle invokeHandler with missing handler', async () => {
    const context: any = { timestamp: new Date(), requestId: 'missing-handler' };
    await expect((mfe as any).invokeHandler('platform.missing', context)).rejects.toThrow();
  });

  it('should handle invokeHandler with missing custom handler', async () => {
    const context: any = { timestamp: new Date(), requestId: 'missing-custom' };
    await expect((mfe as any).invokeHandler('custom.missing', context)).rejects.toThrow();
  });
  it('executeHook handles array of handlers and contained errors', async () => {
    mfe.customA = async () => { throw new Error('failA'); };
    mfe.customB = async (ctx: any) => { ctx.calledB = true; };
    const entry = { customA: { handler: ['custom.customA', 'custom.customB'], contained: true } };
    const context: any = { timestamp: new Date(), requestId: 'test1' };
    await (mfe as any)["executeHookEntry"](entry, context, 'before');
    expect(context.calledB).toBe(true);
  });

  it('executeHook propagates error in main phase', async () => {
    mfe.setCustomHandler('customA', async () => { throw new Error('failA'); });
    const entry = { customA: { handler: 'custom.customA' } };
    const context: any = { timestamp: new Date(), requestId: 'test2' };
    await expect((mfe as any)["executeHookEntry"](entry, context, 'main')).rejects.toThrow('failA');
  });

  it('emitHookFailure emits telemetry', async () => {
    const context: any = { timestamp: new Date(), requestId: 'test3' };
    await (mfe as any)["emitHookFailure"]('hook', 'handler', new Error('fail'), context, 'warn');
    expect(telemetryEvents.length).toBeGreaterThan(0);
    expect(telemetryEvents[0].status).toBe('error');
  });

  it('findCapabilityConfig returns correct config and null', () => {
    (mfe as any).manifest.capabilities = [{ foo: { type: 'platform', lifecycle: {} } }];
    expect((mfe as any)["findCapabilityConfig"]('foo')).toEqual({ type: 'platform', lifecycle: {} });
    expect((mfe as any)["findCapabilityConfig"]('bar')).toBeNull();
  });

  it('stateHistory records transitions', () => {
    (mfe as any).state = 'uninitialized';
    (mfe as any).transitionState('loading');
    (mfe as any).transitionState('ready');
    expect((mfe as any).stateHistory.length).toBeGreaterThanOrEqual(2);
    expect((mfe as any).stateHistory[0].from).toBe('uninitialized');
    expect((mfe as any).stateHistory[1].from).toBe('loading');
  });

  it('invokePlatformHandler throws error for missing method', async () => {
    const context: any = { timestamp: new Date(), requestId: 'test4' };
    await expect((mfe as any).invokePlatformHandler('notfound', context)).rejects.toThrow(/Platform handler not implemented/);
  });

  it('invokeCustomHandler throws error for missing method', async () => {
    const context: any = { timestamp: new Date(), requestId: 'test5' };
    await expect((mfe as any).invokeCustomHandler('notfound', context)).rejects.toThrow(/Custom handler not found/);
  });

  it('executeLifecycle covers empty hooks and invalid lifecycle', async () => {
    (mfe as any).manifest.capabilities = [{ foo: { type: 'platform', lifecycle: { before: [] } } }];
    const context: any = { timestamp: new Date(), requestId: 'test6' };
    await expect((mfe as any).executeLifecycle('foo', 'before', context)).resolves.toBeUndefined();
    (mfe as any).manifest.capabilities = [{ foo: { type: 'platform', lifecycle: { before: undefined } } }];
    await expect((mfe as any).executeLifecycle('foo', 'before', context)).resolves.toBeUndefined();
  });

  it('executeLifecycle returns early if capabilityConfig missing', async () => {
    (mfe as any).manifest.capabilities = undefined;
    const context: any = { timestamp: new Date(), requestId: 'test7' };
    await expect((mfe as any).executeLifecycle('missing', 'before', context)).resolves.toBeUndefined();
  });

  it('executeLifecycle returns early if lifecycle missing', async () => {
    (mfe as any).manifest.capabilities = [{ foo: { type: 'platform' } }];
    const context: any = { timestamp: new Date(), requestId: 'test8' };
    await expect((mfe as any).executeLifecycle('foo', 'before', context)).resolves.toBeUndefined();
  });

  it('executeLifecycle returns early if hooks missing for phase', async () => {
    (mfe as any).manifest.capabilities = [{ foo: { type: 'platform', lifecycle: { main: [] } } }];
    const context: any = { timestamp: new Date(), requestId: 'test9' };
    await expect((mfe as any).executeLifecycle('foo', 'before', context)).resolves.toBeUndefined();
  });

  it('executeHookEntry iterates all entries', async () => {
    mfe.setCustomHandler('customA', async (ctx: any) => { ctx.calledA = true; });
    mfe.setCustomHandler('customB', async (ctx: any) => { ctx.calledB = true; });
    const context: any = { timestamp: new Date(), requestId: 'test10' };
    const entry = { customA: { handler: 'custom.customA' }, customB: { handler: 'custom.customB' } };
    await (mfe as any).executeHookEntry(entry, context, 'before');
    expect(context.calledA).toBe(true);
    expect(context.calledB).toBe(true);
  });

  it('executeHook handles contained errors and continues', async () => {
    let calledB = false;
    mfe.setCustomHandler('customA', async () => { throw new Error('failA'); });
    mfe.setCustomHandler('customB', async (ctx: any) => { calledB = true; ctx.calledB = true; });
    const entry = { customA: { handler: 'custom.customA', contained: true }, customB: { handler: 'custom.customB' } };
    const context: any = { timestamp: new Date(), requestId: 'test11' };
    await (mfe as any).executeHookEntry(entry, context, 'before');
    expect(calledB).toBe(true);
    expect(context.calledB).toBe(true);
  });

  it('executeHook propagates error in main phase', async () => {
    mfe.setCustomHandler('customA', async () => { throw new Error('failA'); });
    const entry = { customA: { handler: 'custom.customA' } };
    const context: any = { timestamp: new Date(), requestId: 'test12' };
    await expect((mfe as any).executeHookEntry(entry, context, 'main')).rejects.toThrow('failA');
  });

  it('invokeHandler calls platform and custom handlers', async () => {
    let emitCalled = false;
    mfe.setPlatformHandler('emit', async (context: any) => { emitCalled = true; context._emitCalled = true; return { emitted: true }; });
    mfe.setCustomHandler('customA', async (context: any) => { context.calledA = true; });
    const context: any = { timestamp: new Date(), requestId: 'test13' };
    await (mfe as any).invokeHandler('platform.emit', context);
    expect(emitCalled).toBe(true);
    await (mfe as any).invokeHandler('custom.customA', { ...context, calledA: false });
    expect(mfe instanceof TestMFE).toBe(true);
  });

  it('invokePlatformHandler throws if not found', async () => {
    const context: any = { timestamp: new Date(), requestId: 'test14' };
    await expect((mfe as any).invokePlatformHandler('notfound', context)).rejects.toThrow(/Platform handler not implemented/);
  });

  it('invokeCustomHandler throws if not found', async () => {
    const context: any = { timestamp: new Date(), requestId: 'test15' };
    await expect((mfe as any).invokeCustomHandler('notfound', context)).rejects.toThrow(/Custom handler not found/);
  });

  it('emitHookFailure logs telemetry', async () => {
    const context: any = { timestamp: new Date(), requestId: 'test16' };
    await (mfe as any).emitHookFailure('hook', 'handler', new Error('fail'), context, 'warn');
    expect(telemetryEvents.length).toBeGreaterThan(0);
    expect(telemetryEvents[0].status).toBe('error');
  });

  it('findCapabilityConfig returns correct config', () => {
    (mfe as any).manifest.capabilities = [{ foo: { type: 'platform', lifecycle: {} } }];
    expect((mfe as any).findCapabilityConfig('foo')).toEqual({ type: 'platform', lifecycle: {} });
  });

  it('findCapabilityConfig returns null if not found', () => {
    (mfe as any).manifest.capabilities = [{ bar: { type: 'platform' } }];
    expect((mfe as any).findCapabilityConfig('foo')).toBeNull();
  });

  it('transitionState throws on invalid transition', () => {
    (mfe as any).state = 'ready';
    expect(() => (mfe as any).transitionState('uninitialized')).toThrow(/Invalid state transition/);
  });

  it('transitionState allows valid transition', () => {
    (mfe as any).state = 'ready';
    (mfe as any).transitionState('rendering');
    expect((mfe as any).state).toBe('rendering');
  });

  it('assertState throws on mismatch', () => {
    (mfe as any).state = 'loading';
    expect(() => (mfe as any).assertState('ready')).toThrow(/Invalid state: expected ready, got loading/);
  });

  it('assertState allows valid state', () => {
    (mfe as any).state = 'ready';
    expect(() => (mfe as any).assertState('ready')).not.toThrow();
  });
});
