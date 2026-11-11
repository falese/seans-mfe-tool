import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { closure, declaringFile, inlineReads, exportsByName, importsOf, packageOf, providerTree, pruneUnusedImports, resolveRelative, routesBlocks, type Read } from '../source';

const MONOLITH = path.resolve(__dirname, '../../../../examples/meridian-monolith');
const read: Read = (f) => {
  try {
    return fs.readFileSync(path.join(MONOLITH, f), 'utf8');
  } catch {
    return undefined;
  }
};

describe('reading the monolith for a port (ADR-126)', () => {
  it('resolves relative imports to files, index files included', () => {
    expect(resolveRelative('src/App.tsx', './pages/cargo', read)).toBe('src/pages/cargo/index.tsx');
    expect(resolveRelative('src/App.tsx', './layout/Sidebar', read)).toBe('src/layout/Sidebar.tsx');
    expect(resolveRelative('src/App.tsx', 'react', read)).toBeUndefined();
    expect(packageOf('@babylonjs/core/Maths')).toBe('@babylonjs/core');
    expect(packageOf('react-dom/client')).toBe('react-dom');
  });

  it('follows re-exports to the file that declares a component', () => {
    expect(declaringFile(ts, 'src/pages/cargo/index.tsx', 'HazardSummary', read)).toBe('src/pages/cargo/HazardSummary.tsx');
    expect(declaringFile(ts, 'src/pages/cargo/index.tsx', 'default', read)).toBe('src/pages/cargo/CargoManifest.tsx');
  });

  it('collects a capability\'s closure and the packages it uses', () => {
    const c = closure(ts, ['src/components/crew/CrewRoster.tsx'], read);
    expect(c.files).toContain('src/components/crew/CrewRoster.tsx');
    expect(c.files).toContain('src/api/client.ts');
    expect(c.files.some((f) => f.startsWith('src/pages/'))).toBe(false);
    expect(c.packages).toContain('react');
  });

  it('reads the provider tree the entry renders around its root', () => {
    const tree = providerTree(ts, 'src/index.tsx', read('src/index.tsx') as string, 'App');
    expect(tree?.jsx.replace(/\s+/g, ' ')).toBe('<BrowserRouter> <AppProvider> __CHILD__ </AppProvider> </BrowserRouter>');
    expect(tree?.imports.map((i) => i.spec)).toEqual(['react-router-dom', './store/AppContext']);
  });

  it('finds the shell\'s route blocks and what each route renders', () => {
    const blocks = routesBlocks(ts, 'src/App.tsx', read('src/App.tsx') as string);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].routes.find((r) => r.path === '/cargo')?.element).toBe('CargoPage');
    expect(blocks[1].routes.find((r) => r.path === '/cargo')?.element).toBe('HazardSummary');
    expect(blocks[0].routes.find((r) => r.path === '/')?.element).toBeNull();
  });

  it('knows whether a component is exported by name or only as the default', () => {
    expect(exportsByName(ts, 'x.tsx', 'export function A() {}\nexport const B = 1;', 'A')).toBe(true);
    expect(exportsByName(ts, 'x.tsx', 'export default function A() {}', 'A')).toBe(false);
  });

  it('drops imports nothing uses any more', () => {
    const src = "import React from 'react';\nimport A from './A';\nimport { B, C } from './B';\nexport const x = <B />;\n";
    expect(pruneUnusedImports(ts, 'x.tsx', src)).toBe("import React from 'react';\nimport { B, C } from './B';\nexport const x = <B />;\n");
    expect(importsOf(ts, 'x.tsx', src)[2].named).toEqual([{ imported: 'B', local: 'B' }, { imported: 'C', local: 'C' }]);
  });

  it('rewrites each data function in place: the monolith\'s call kept as the standalone path (ADR-128 §2)', () => {
    const client = read('src/api/client.ts') as string;
    const r = inlineReads(
      ts,
      'src/api/client.ts',
      client,
      [
        { name: 'getBerths', read: { document: 'query { listBerths { berthId } }', field: 'listBerths' }, variables: {}, unless: [] },
        { name: 'getDockings', read: { document: 'query { listDockings { id } }', field: 'listDockings' }, variables: {}, unless: ['berthId'] },
        { name: 'getModules', empty: [] },
        { name: 'getCrew', monolith: 'no spec' },
      ],
      '../__port__/via-bff'
    );
    expect(r.text).toContain(
      "export const getBerths = () => viaBff(() => hm<Berth>('/berths'), { document: \"query { listBerths { berthId } }\", field: \"listBerths\" });"
    );
    // A parameter the BFF cannot take keeps the monolith's call whenever it is given.
    expect(r.text).toContain('field: "listDockings" }, berthId === undefined);');
    expect(r.text).toContain("export const getModules = () => viaBff(() => sos<Module>('/modules'), { empty: [] });");
    expect(r.text).toContain("export const getCrew = () => sos<CrewMember>('/crew');");
    expect(r.text).toContain("import { viaBff } from '../__port__/via-bff';");
    // The monolith's transport stays: it is the standalone path.
    expect(r.text).toContain("import axios from 'axios';");
    expect(r).toMatchObject({ inlined: ['getBerths', 'getDockings', 'getModules'], monolith: ['getCrew: no spec'] });
  });

  it('wraps block-bodied and declared functions too, keeping async', () => {
    const src = "export async function load(id) {\n  const r = await http.get(`/x/${id}`);\n  return r.data;\n}\nexport const other = async () => {\n  return 1;\n};\n";
    const r = inlineReads(ts, 'x.ts', src, [{ name: 'load', read: { document: 'q', field: 'f' }, variables: { id: 'id' }, unless: [] }, { name: 'other', empty: null }], './via-bff');
    expect(r.text).toContain('return viaBff(async () => {\n  const r = await http.get(`/x/${id}`);\n  return r.data;\n}, { document: "q", field: "f", variables: { id } });');
    expect(r.text).toContain('export const other = async () => viaBff(async () => {\n  return 1;\n}, { empty: null });');
  });
});
