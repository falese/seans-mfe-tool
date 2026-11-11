import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { closure, declaringFile, exportsByName, importsOf, packageOf, providerTree, pruneUnusedImports, resolveRelative, routesBlocks, type Read } from '../source';

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
});
