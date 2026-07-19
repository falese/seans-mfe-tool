
import { meridianlifesupportMFE } from './mfe';
import type { Context } from '@seans-mfe-tool/runtime';

describe('meridianlifesupportMFE', () => {
  let mfe: meridianlifesupportMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = { name: 'meridian-life-support', version: '1.0.0', remoteEntry: 'http://localhost:5003/remoteEntry.js' };
    mfe = new meridianlifesupportMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test-request-id' } as Context;
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(meridianlifesupportMFE);
  });

  // ---------------------------------------------------------------------------
  // Platform capability smoke tests
  // (Platform capabilities are inherited from AngularRemoteMFE → BaseMFE —
  //  these verify the class extends the base without overriding core behaviour)
  // ---------------------------------------------------------------------------

  it('should expose all 10 platform capabilities from AngularRemoteMFE', () => {
    expect(typeof mfe.load).toBe('function');
    expect(typeof mfe.render).toBe('function');
    expect(typeof mfe.refresh).toBe('function');
    expect(typeof mfe.authorizeAccess).toBe('function');
    expect(typeof mfe.health).toBe('function');
    expect(typeof mfe.describe).toBe('function');
    expect(typeof mfe.schema).toBe('function');
    expect(typeof mfe.query).toBe('function');
    expect(typeof mfe.emit).toBe('function');
    expect(typeof mfe.updateControlPlaneState).toBe('function');
  });

  // ---------------------------------------------------------------------------
  // Domain capability smoke tests
  // ---------------------------------------------------------------------------


  it('should call TelemetryDashboard() and return an object', async () => {
    const result = await mfe.TelemetryDashboard(context);
    expect(result).toBeDefined();
  });

  it('should call ModuleStatus() and return an object', async () => {
    const result = await mfe.ModuleStatus(context);
    expect(result).toBeDefined();
  });

  it('should call AlertsFeed() and return an object', async () => {
    const result = await mfe.AlertsFeed(context);
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
