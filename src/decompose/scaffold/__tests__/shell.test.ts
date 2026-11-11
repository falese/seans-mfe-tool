import * as ts from 'typescript';
import { routesModule, shellFiles } from '../shell';

/** Transpile and load a generated module, as the shell's bundler would. */
function load(source: string): { stateFor(p: string): string | null; ROUTES: unknown[] } {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', js)(module, module.exports);
  return module.exports as unknown as { stateFor(p: string): string | null; ROUTES: unknown[] };
}

describe('the shell enters state keys from the URL (ADR-126 §5)', () => {
  const routes = [
    { path: '/', stateKey: 'app.root' },
    { path: '/cargo', stateKey: 'app.open.cargo' },
    { path: '/cargo/hazards', stateKey: 'app.open.hazards' },
  ];

  it('matches the exact path first, then the longest prefix, and nothing else', () => {
    const m = load(routesModule(routes));
    expect(m.stateFor('/')).toBe('app.root');
    expect(m.stateFor('/cargo')).toBe('app.open.cargo');
    expect(m.stateFor('/cargo/hazards/7')).toBe('app.open.hazards');
    expect(m.stateFor('/cargo/42')).toBe('app.open.cargo');
    expect(m.stateFor('/cargoes')).toBeNull();
    expect(m.stateFor('/unknown')).toBeNull();
  });

  it('starts empty: under the legacy composition the monolith routes itself', () => {
    const files = shellFiles({ namespace: 'app', title: 'app', port: 1, daemonWsUrl: 'ws://localhost:3004/graphql', headStyles: '', proxy: null });
    expect(load(files['src/routes.ts']).ROUTES).toEqual([]);
    expect(files['src/App.tsx']).toContain("import { stateFor } from './routes';");
    expect(files['src/App.tsx']).toContain('const unwatch = watchHistory(');
  });
});
