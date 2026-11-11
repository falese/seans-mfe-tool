import * as ts from 'typescript';
import { viaBffModule } from '../shim';

type ViaBff = <R>(monolith: () => R, read: { document: string; field: string; variables?: Record<string, unknown> } | { empty: unknown }, when?: boolean) => R;

/** Transpile and load the generated helper with a stand-in base-class instance. */
function load(mfe: { inControlPlane(): boolean; getState?: () => string; query: jest.Mock }): ViaBff {
  const js = ts.transpileModule(viaBffModule(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  class BusinessError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
    }
  }
  const modules: Record<string, unknown> = { '@seans-mfe-tool/runtime': { BusinessError }, '../../platform/base-mfe/bootstrap': { mfe: { getState: () => 'ready', ...mfe } } };
  const module = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', 'require', js)(module, module.exports, (m: string) => modules[m]);
  return module.exports.viaBff as ViaBff;
}

// The repository runs Jest with fake timers; the helper's wait for ready is a real timer.
beforeEach(() => jest.useRealTimers());

describe('viaBff, the helper a port writes (ADR-128)', () => {
  const read = { document: 'query { listBerths { berthId } }', field: 'listBerths' };

  it('runs the monolith\'s own code when the MFE runs alone', async () => {
    const mfe = { inControlPlane: () => false, query: jest.fn() };
    const viaBff = load(mfe);
    await expect(viaBff(() => Promise.resolve(['from the monolith']), read)).resolves.toEqual(['from the monolith']);
    expect(mfe.query).not.toHaveBeenCalled();
  });

  it('reads through the base class\'s query capability when a host has composed it', async () => {
    const mfe = { inControlPlane: () => true, query: jest.fn(async () => ({ data: { listBerths: [{ berthId: 'b1' }] } })) };
    const viaBff = load(mfe);
    const monolith = jest.fn();
    await expect(viaBff(monolith, { ...read, variables: { id: 4 } })).resolves.toEqual([{ berthId: 'b1' }]);
    expect(monolith).not.toHaveBeenCalled();
    expect(mfe.query).toHaveBeenCalledWith(expect.objectContaining({ inputs: { document: read.document, variables: { id: 4 } } }));
  });

  it('returns data this MFE does not front as empty, with no request', async () => {
    const mfe = { inControlPlane: () => true, query: jest.fn() };
    await expect(load(mfe)(() => Promise.resolve('x'), { empty: [] })).resolves.toEqual([]);
    expect(mfe.query).not.toHaveBeenCalled();
  });

  it('keeps the monolith\'s call when given an argument the BFF cannot take', async () => {
    const mfe = { inControlPlane: () => true, query: jest.fn() };
    await expect(load(mfe)(() => Promise.resolve('direct'), read, false)).resolves.toBe('direct');
    expect(mfe.query).not.toHaveBeenCalled();
  });

  it('waits for the MFE to be ready: query is ready-only, and components fetch while it is still rendering', async () => {
    let state = 'rendering';
    const mfe = { inControlPlane: () => true, getState: () => state, query: jest.fn(async () => ({ data: { listBerths: [] } })) };
    const pending = load(mfe)(() => Promise.resolve(null), read);
    await new Promise((r) => setTimeout(r, 30));
    expect(mfe.query).not.toHaveBeenCalled();
    state = 'ready';
    await expect(pending).resolves.toEqual([]);
    expect(mfe.query).toHaveBeenCalledTimes(1);
  });

  it('gives up on an MFE that fails instead of becoming ready', async () => {
    const mfe = { inControlPlane: () => true, getState: () => 'error', query: jest.fn() };
    await expect(load(mfe)(() => Promise.resolve(null), read)).rejects.toMatchObject({ code: 'MFE_NOT_READY' });
    expect(mfe.query).not.toHaveBeenCalled();
  });

  it('turns GraphQL errors into a typed error', async () => {
    const mfe = { inControlPlane: () => true, query: jest.fn(async () => ({ data: null, errors: [{ message: 'boom' }] })) };
    await expect(load(mfe)(() => Promise.resolve(null), read)).rejects.toMatchObject({ code: 'BFF_GRAPHQL_ERROR', message: 'boom' });
  });
});
