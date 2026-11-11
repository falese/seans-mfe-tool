/**
 * The generated harness is executed here, not just written: it is transpiled
 * the way an MFE's ts-jest would, and run.
 */
import * as ts from 'typescript';
import { RECORDED_NETWORK } from '../harness';

interface Harness {
  installRecordedNetwork(r: Record<string, { status: number; mimeType: string; body: unknown }>): { calls: string[]; unexpected: string[]; restore(): void };
  missingText(page: string, expected: string): string | null;
  requestKey(method: string, url: string): string;
}

function load(): Harness {
  const js = ts.transpileModule(RECORDED_NETWORK, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true } });
  expect(js.diagnostics ?? []).toEqual([]);
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', js.outputText)(mod, mod.exports);
  return mod.exports as unknown as Harness;
}

describe('the generated recorded-network harness', () => {
  // The harness answers on a real tick, as it does in an MFE's jsdom; this repo fakes timers by default.
  beforeAll(() => jest.useRealTimers());
  const h = load();
  const responses = {
    'GET /api/harbormaster/berths': { status: 200, mimeType: 'application/json', body: [{ berth_id: 'b1' }] },
  };

  it('type-checks as strict TypeScript', () => {
    const host = ts.createCompilerHost({});
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (name, lang) => (name === 'harness.ts' ? ts.createSourceFile(name, RECORDED_NETWORK, lang) : original(name, lang));
    const program = ts.createProgram(['harness.ts'], { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [] }, host);
    expect(ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  });

  it('serves fetch from the recording and lists what it could not answer', async () => {
    const net = h.installRecordedNetwork(responses);
    try {
      const f = globalThis.fetch as unknown as (u: string) => Promise<{ status: number; json(): Promise<unknown> }>;
      const ok = await f('/api/harbormaster/berths');
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual([{ berth_id: 'b1' }]);
      expect((await f('/api/ledger/charges')).status).toBe(404);
      expect(net.calls).toEqual(['GET /api/harbormaster/berths', 'GET /api/ledger/charges']);
      expect(net.unexpected).toEqual(['GET /api/ledger/charges']);
    } finally {
      net.restore();
    }
  });

  it('serves XMLHttpRequest the way axios reads it: onloadend, status, responseText', async () => {
    const net = h.installRecordedNetwork(responses);
    try {
      const Xhr = (globalThis as unknown as { XMLHttpRequest: new () => Record<string, unknown> & { open(m: string, u: string): void; send(): void; getAllResponseHeaders(): string } }).XMLHttpRequest;
      const x = new Xhr();
      expect('onloadend' in x).toBe(true);
      const done = new Promise<void>((resolve) => {
        x.onloadend = () => resolve();
      });
      x.open('get', '/api/harbormaster/berths');
      x.send();
      await done;
      expect(x.status).toBe(200);
      expect(JSON.parse(x.responseText as string)).toEqual([{ berth_id: 'b1' }]);
      expect(x.getAllResponseHeaders()).toContain('application/json');
    } finally {
      net.restore();
    }
  });

  it('restores the globals it replaced', () => {
    const before = globalThis.fetch;
    h.installRecordedNetwork({}).restore();
    expect(globalThis.fetch).toBe(before);
  });

  it('finds expected text in order, whitespace aside', () => {
    expect(h.missingText('Docking board3 vessels', 'Docking board 3')).toBeNull();
    expect(h.missingText('3 Docking board', 'Docking board 3')).toBe('3');
    expect(h.missingText('Docking', 'Docking board')).toBe('board');
  });

  it('keys requests relative to the origin, other origins absolute', () => {
    expect(h.requestKey('get', 'http://localhost/api/x?a=1')).toBe('GET /api/x?a=1');
    expect(h.requestKey('GET', 'http://elsewhere:9/api/x')).toBe('GET http://elsewhere:9/api/x');
  });
});
