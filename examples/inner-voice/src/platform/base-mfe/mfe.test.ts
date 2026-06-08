
import { innervoiceMFE } from './mfe';
import type { Context } from '@seans-mfe-tool/runtime';

describe('innervoiceMFE', () => {
  let mfe: innervoiceMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = { name: 'inner-voice', version: '1.0.0', remoteEntry: 'http://localhost:3009/remoteEntry.js' };
    mfe = new innervoiceMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test-request-id' } as Context;
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(innervoiceMFE);
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


  it('should call InnerVoice() and return an object', async () => {
    const result = await mfe.InnerVoice(context);
    expect(result).toBeDefined();
  });


  // ---------------------------------------------------------------------------
  // Lifecycle hook smoke tests
  // (Hooks are protected — accessed via cast to verify they exist)
  // ---------------------------------------------------------------------------

  it('should have lifecycle hook onLoadError', () => {
    expect(typeof (mfe as any).onLoadError).toBe('function');
  });

});
