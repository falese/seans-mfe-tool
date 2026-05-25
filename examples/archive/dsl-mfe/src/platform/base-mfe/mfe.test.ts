import { csvanalyzerMFE } from './mfe';
import type { Context } from '@seans-mfe-tool/runtime';

describe('csvanalyzerMFE', () => {
  let mfe: csvanalyzerMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = { name: 'csv-analyzer', version: '1.0.0', remoteEntry: 'http://localhost:3002/remoteEntry.js' };
    mfe = new csvanalyzerMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test-request-id' } as Context;
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(csvanalyzerMFE);
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

  it('should call DataAnalysis() and return an object', async () => {
    const result = await mfe.DataAnalysis(context);
    expect(result).toBeDefined();
  });

  it('should call ReportViewer() and return an object', async () => {
    const result = await mfe.ReportViewer(context);
    expect(result).toBeDefined();
  });

  it('should call DataAnalysisDetailed() and return an object', async () => {
    const result = await mfe.DataAnalysisDetailed(context);
    expect(result).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Lifecycle hook smoke tests
  // (Hooks are protected — accessed via cast to verify they exist)
  // ---------------------------------------------------------------------------

  it('should have lifecycle hook validateConfig', () => {
    expect(typeof (mfe as any).validateConfig).toBe('function');
  });

  it('should have lifecycle hook checkDependencies', () => {
    expect(typeof (mfe as any).checkDependencies).toBe('function');
  });

  it('should have lifecycle hook initializeRuntime', () => {
    expect(typeof (mfe as any).initializeRuntime).toBe('function');
  });

  it('should have lifecycle hook emitReadyEvent', () => {
    expect(typeof (mfe as any).emitReadyEvent).toBe('function');
  });

  it('should have lifecycle hook cleanup', () => {
    expect(typeof (mfe as any).cleanup).toBe('function');
  });

  it('should have lifecycle hook validateProps', () => {
    expect(typeof (mfe as any).validateProps).toBe('function');
  });

  it('should have lifecycle hook checkAuthorization', () => {
    expect(typeof (mfe as any).checkAuthorization).toBe('function');
  });

  it('should have lifecycle hook performRender', () => {
    expect(typeof (mfe as any).performRender).toBe('function');
  });

  it('should have lifecycle hook attachEventHandlers', () => {
    expect(typeof (mfe as any).attachEventHandlers).toBe('function');
  });

  it('should have lifecycle hook renderErrorBoundary', () => {
    expect(typeof (mfe as any).renderErrorBoundary).toBe('function');
  });

  it('should have lifecycle hook validateFile', () => {
    expect(typeof (mfe as any).validateFile).toBe('function');
  });

  it('should have lifecycle hook processData', () => {
    expect(typeof (mfe as any).processData).toBe('function');
  });

  it('should have lifecycle hook completeAnalysis', () => {
    expect(typeof (mfe as any).completeAnalysis).toBe('function');
  });

  it('should have lifecycle hook handleError', () => {
    expect(typeof (mfe as any).handleError).toBe('function');
  });
});
