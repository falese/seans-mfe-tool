
import { abckidsletterpopMFE } from './mfe';
import type { Context } from '@seans-mfe-tool/runtime';

describe('abckidsletterpopMFE', () => {
  let mfe: abckidsletterpopMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = { name: 'abc-kids-letter-pop', version: '1.0.0', remoteEntry: 'http://localhost:3006/remoteEntry.js' };
    mfe = new abckidsletterpopMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test-request-id' } as Context;
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(abckidsletterpopMFE);
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


  it('should call PlayGame() and return an object', async () => {
    const result = await mfe.PlayGame(context);
    expect(result).toBeDefined();
  });

  it('should call ShowCover() and return an object', async () => {
    const result = await mfe.ShowCover(context);
    expect(result).toBeDefined();
  });

  it('should call GetGameInfo() and return an object', async () => {
    const result = await mfe.GetGameInfo(context);
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
