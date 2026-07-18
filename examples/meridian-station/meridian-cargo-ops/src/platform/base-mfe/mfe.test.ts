
import { meridiancargoopsMFE } from './mfe';
import type { Context } from '@seans-mfe-tool/runtime';

describe('meridiancargoopsMFE', () => {
  let mfe: meridiancargoopsMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = { name: 'meridian-cargo-ops', version: '1.0.0', remoteEntry: 'http://localhost:5004/remoteEntry.js' };
    mfe = new meridiancargoopsMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test-request-id' } as Context;
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(meridiancargoopsMFE);
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


  it('should call CargoManifest() and return an object', async () => {
    const result = await mfe.CargoManifest(context);
    expect(result).toBeDefined();
  });

  it('should call HazardSummary() and return an object', async () => {
    const result = await mfe.HazardSummary(context);
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
