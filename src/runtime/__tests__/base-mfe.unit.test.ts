/**
 * BaseMFE Unit Tests for coverage
 */

import { BaseMFE } from '../base-mfe';

class TestMFE extends BaseMFE {
    async fail(context: any) {
      console.log('fail method called');
      throw new Error('boom');
    }
  handlers: Record<string, any>;
  constructor(manifest: any) {
    console.log('TestMFE constructor called');
    super(manifest);
    this.handlers = {
      'custom.load': async (ctx: any) => { console.log('custom.load handler called'); return { status: 'loaded', timestamp: new Date(), context: ctx }; },
      'custom.query': async (ctx: any) => { console.log('custom.query handler called'); return { data: 123, errors: [], timestamp: new Date() }; },
      'custom.fail': async () => { console.log('custom.fail handler called'); throw new Error('boom'); },
      'fail': async () => { console.log('fail handler called'); throw new Error('boom'); },
      'custom.noop': async () => { console.log('custom.noop handler called'); return { emitted: true }; }
    };
  }
  async doLoad(context: any): Promise<any> {
    console.log('doLoad called');
    return { status: 'loaded', timestamp: new Date(), context };
  }
  async doRender(context: any): Promise<any> {
    console.log('doRender called');
    return { status: 'rendered', element: {}, timestamp: new Date() };
  }
  async doRefresh(context: any): Promise<any> {
    console.log('doRefresh called');
    return { status: 'refreshed', timestamp: new Date() };
  }
  async doAuthorizeAccess(context: any): Promise<any> {
    console.log('doAuthorizeAccess called');
    return { status: 'authorized', timestamp: new Date() };
  }
  async doHealth(context: any): Promise<any> {
    console.log('doHealth called');
    return { status: 'healthy', timestamp: new Date() };
  }
  async doDescribe(context: any): Promise<any> {
    console.log('doDescribe called');
    return { status: 'described', timestamp: new Date() };
  }
  async doSchema(context: any): Promise<any> {
    console.log('doSchema called');
    return { schema: '{}', format: 'json', timestamp: new Date() };
  }
  async doQuery(context: any): Promise<any> {
    console.log('doQuery called');
    return { data: 123, errors: [], timestamp: new Date() };
  }
  async doEmit(context: any): Promise<any> {
    console.log('doEmit called');
    return { emitted: true };
  }
  async doUpdateControlPlaneState(context: any): Promise<any> {
    console.log('doUpdateControlPlaneState called');
    return { acknowledged: true, correlationId: context.requestId || 'test' };
  }
  async resolveHandler(name: string) {
    console.log('resolveHandler called for', name);
    return this.handlers[name];
  }
}

describe('BaseMFE state and platform wrappers', () => {
  let mfe: TestMFE;
  beforeEach(async () => {
    const manifest = {
      name: 't', version: '1.0.0', type: 'tool', language: 'typescript', capabilities: [
        { query: { type: 'domain', lifecycle: { main: [{ doQuery: { handler: 'custom.query' } }] } } },
        // { load: { type: 'platform' } },
        // { emit: { type: 'platform', lifecycle: { main: [{ doEmit: { handler: 'custom.noop' } }] } } }
      ]
    };
    mfe = new TestMFE(manifest);
    // Avoid invoking load lifecycle in unit harness; set state to ready
    (mfe as any).state = 'ready';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('query wrapper calls lifecycle', async () => {
    const context = { timestamp: new Date(), requestId: 'test-query', phase: 'main' as 'main', capability: 'query' };
    const res = await mfe.query(context);
    expect(res.data).toBe(123);
    expect(Array.isArray(res.errors)).toBe(true);
    // QueryResult does not have timestamp property
  });

  it('emit wrapper calls lifecycle', async () => {
    const context = { timestamp: new Date(), requestId: 'test-emit', phase: 'main' as 'main', capability: 'emit' };
    const res = await mfe.emit(context);
    expect(res.emitted).toBe(true);
  });
});

describe('BaseMFE error hooks and telemetry', () => {
  let mfe: TestMFE;
  beforeEach(async () => {
    const manifest = {
      name: 't', version: '1.0.0', type: 'tool', language: 'typescript', capabilities: [
        { query: { type: 'domain', lifecycle: { main: [{ doQuery: { handler: 'custom.fail' } }], error: [{ onError: { handler: 'custom.noop' } }] } } }
      ]
    };
    mfe = new TestMFE(manifest);
    (mfe as any).state = 'ready';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('main failure propagates and telemetry logs error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const context = { timestamp: new Date(), requestId: 'fail-query', phase: 'main' as 'main', capability: 'query' };
    await expect(mfe.query(context)).rejects.toThrow('boom');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('BaseMFE updateControlPlaneState', () => {
  let mfe: TestMFE;
  beforeEach(() => {
    const manifest = {
      name: 't', version: '1.0.0', type: 'tool', language: 'typescript', capabilities: []
    };
    mfe = new TestMFE(manifest);
    (mfe as any).state = 'ready';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls doUpdateControlPlaneState and returns result', async () => {
    const context = { timestamp: new Date(), requestId: 'upd-1', inputs: { stateKey: 'analysis.complete', stateData: {} } };
    const res = await mfe.updateControlPlaneState(context as any);
    expect(res.acknowledged).toBe(true);
    expect(res.correlationId).toBe('upd-1');
  });

  it('is available from rendering state', async () => {
    (mfe as any).state = 'rendering';
    const context = { timestamp: new Date(), requestId: 'upd-2', inputs: { stateKey: 'form.submitted', stateData: {} } };
    const res = await mfe.updateControlPlaneState(context as any);
    expect(res.acknowledged).toBe(true);
  });

  it('throws when called from invalid state', async () => {
    (mfe as any).state = 'loading';
    const context = { timestamp: new Date(), requestId: 'upd-3', inputs: { stateKey: 'test', stateData: {} } };
    await expect(mfe.updateControlPlaneState(context as any)).rejects.toThrow();
  });

  it('propagates error from doUpdateControlPlaneState', async () => {
    jest.spyOn(mfe as any, 'doUpdateControlPlaneState').mockRejectedValue(new Error('control-plane error'));
    const context = { timestamp: new Date(), requestId: 'upd-4', inputs: { stateKey: 'error.escalation', stateData: {} } };
    await expect(mfe.updateControlPlaneState(context as any)).rejects.toThrow('control-plane error');
  });
});
