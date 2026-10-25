
import { decompositionworkspaceMFE } from './mfe';
import type { Context } from '@seans-mfe-tool/runtime';

describe('decompositionworkspaceMFE', () => {
  let mfe: decompositionworkspaceMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = { name: 'decomposition-workspace', version: '1.0.0', remoteEntry: 'http://localhost:4611/remoteEntry.js' };
    mfe = new decompositionworkspaceMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test-request-id' } as Context;
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(decompositionworkspaceMFE);
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


  it('should call ProposalMap() and return an object', async () => {
    const result = await mfe.ProposalMap(context);
    expect(result).toBeDefined();
  });

  it('should call ShapeProposal() and return an object', async () => {
    const result = await mfe.ShapeProposal(context);
    expect(result).toBeDefined();
  });

  it('should call AgentPane() and return an object', async () => {
    const result = await mfe.AgentPane(context);
    expect(result).toBeDefined();
  });

  it('should call ApproveProposal() and return an object', async () => {
    const result = await mfe.ApproveProposal(context);
    expect(result).toBeDefined();
  });


  // ---------------------------------------------------------------------------
  // Lifecycle hook smoke tests
  // (Hooks are protected — accessed via cast to verify they exist)
  // ---------------------------------------------------------------------------

  it('should have lifecycle hook onLoadError', () => {
    expect(typeof (mfe as any).onLoadError).toBe('function');
  });

  it('should have lifecycle hook onRenderError', () => {
    expect(typeof (mfe as any).onRenderError).toBe('function');
  });

});
