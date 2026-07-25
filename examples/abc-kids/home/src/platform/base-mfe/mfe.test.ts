
import { abckidshomeMFE } from './mfe';
import type { Context } from '@seans-mfe-tool/runtime';

describe('abckidshomeMFE', () => {
  let mfe: abckidshomeMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = { name: 'abc-kids-home', version: '1.0.0', remoteEntry: 'http://localhost:3015/remoteEntry.js' };
    mfe = new abckidshomeMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test-request-id' } as Context;
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(abckidshomeMFE);
  });

  // ---------------------------------------------------------------------------
  // Platform capability smoke tests
  // (Platform capabilities are inherited from RemoteMFE — these verify the
  //  class correctly extends the base without overriding core behaviour)
  // ---------------------------------------------------------------------------

  it('should expose all 9 platform capabilities from RemoteMFE', () => {
    expect(typeof mfe.load).toBe('function');
    expect(typeof mfe.render).toBe('function');
    expect(typeof mfe.refresh).toBe('function');
    expect(typeof mfe.authorizeAccess).toBe('function');
    expect(typeof mfe.health).toBe('function');
    expect(typeof mfe.describe).toBe('function');
    expect(typeof mfe.schema).toBe('function');
    expect(typeof mfe.query).toBe('function');
    expect(typeof mfe.emit).toBe('function');
  });

  // ---------------------------------------------------------------------------
  // Domain capability smoke tests
  // ---------------------------------------------------------------------------


  it('should call GameMenu() and return an object', async () => {
    const result = await mfe.GameMenu(context);
    expect(result).toBeDefined();
  });


  // ---------------------------------------------------------------------------
  // Lifecycle hook smoke tests
  // (Hooks are protected — accessed via cast to verify they exist)
  // ---------------------------------------------------------------------------

  it('should have lifecycle hook onLoadBegin', () => {
    expect(typeof (mfe as any).onLoadBegin).toBe('function');
  });

  it('should have lifecycle hook onLoadComplete', () => {
    expect(typeof (mfe as any).onLoadComplete).toBe('function');
  });

  it('should have lifecycle hook onLoadError', () => {
    expect(typeof (mfe as any).onLoadError).toBe('function');
  });

  it('should have lifecycle hook onRenderBegin', () => {
    expect(typeof (mfe as any).onRenderBegin).toBe('function');
  });

  it('should have lifecycle hook onRenderComplete', () => {
    expect(typeof (mfe as any).onRenderComplete).toBe('function');
  });

  it('should have lifecycle hook onRenderError', () => {
    expect(typeof (mfe as any).onRenderError).toBe('function');
  });

});
