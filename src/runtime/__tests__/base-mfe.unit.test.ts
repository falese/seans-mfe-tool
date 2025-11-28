/**
 * BaseMFE Unit Tests for coverage
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BaseMFE } = require('../base-mfe.ts');

class TestMFE extends BaseMFE {
  constructor(manifest: any) {
    super(manifest);
    this.handlers = {
      'custom.load': async (ctx: any) => ({ ok: true, context: ctx }),
      'custom.query': async (ctx: any) => ({ ok: true, data: 123, context: ctx }),
      'custom.fail': async () => { throw new Error('boom'); },
      'custom.noop': async () => ({ ok: true })
    };
  }
  async doLoad(context: any) {
    return { ok: true, context };
  }
  async resolveHandler(name: string) {
    return this.handlers[name];
  }
}

describe('BaseMFE state and platform wrappers', () => {
  let mfe: TestMFE;
  beforeEach(async () => {
    const manifest = {
      name: 't', version: '1.0.0', type: 'tool', language: 'typescript', capabilities: [
        { query: { type: 'domain', lifecycle: { main: [{ doQuery: { handler: 'custom.query' } }] } } },
        { load: { type: 'platform' } },
        { emit: { type: 'platform', lifecycle: { main: [{ doEmit: { handler: 'custom.noop' } }] } } }
      ]
    };
    mfe = new TestMFE(manifest);
    // Avoid invoking load lifecycle in unit harness; set state to ready
    (mfe as any).state = 'ready';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('valid transitions ready → rendering → ready', async () => {
    expect(() => mfe.transitionState('rendering')).not.toThrow();
    expect(() => mfe.transitionState('ready')).not.toThrow();
  });

  it('invalid transition throws', () => {
    expect(() => mfe.transitionState('error')).toThrow();
  });

  it('query wrapper calls lifecycle', async () => {
    const res = await mfe.query({});
    expect(res.ok).toBe(true);
    expect(res.data).toBe(123);
  });

  it('emit wrapper calls lifecycle', async () => {
    const res = await mfe.emit({});
    expect(res.ok).toBe(true);
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

  it('main failure propagates and telemetry logs error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(mfe.query({})).rejects.toThrow('boom');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
