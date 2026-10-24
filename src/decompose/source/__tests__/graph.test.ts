import * as ts from 'typescript';
import { parseFile } from '../parse';
import { buildSourceGraph, resolveModule } from '../graph';

function project(files: Record<string, string>) {
  return buildSourceGraph(Object.entries(files).map(([file, text]) => parseFile(ts, file, text)));
}

const APP = {
  'src/index.tsx': `import App from './App'; import { AppProvider } from './store/AppContext'; render(<AppProvider><App /></AppProvider>);`,
  'src/App.tsx': `
    import Sidebar from './layout/Sidebar';
    import DockingBoard from './components/DockingBoard';
    import CargoPage, { HazardSummary } from './pages/cargo';
    export default function App() {
      return (<div><Sidebar />
        <main><Routes><Route path="/docking" element={<DockingBoard />} /><Route path="/cargo" element={<CargoPage />} /></Routes></main>
        <aside><Routes><Route path="/cargo" element={<HazardSummary />} /></Routes></aside>
      </div>);
    }`,
  'src/layout/Sidebar.tsx': `import { useAppState } from '../store/AppContext'; export default function Sidebar() { const { telemetry } = useAppState(); return <nav />; }`,
  'src/components/DockingBoard.tsx': `import { useAppState } from '../store/AppContext'; import StatusChip from './StatusChip';
    export default function DockingBoard() { const { dockings } = useAppState(); return <table><StatusChip /></table>; }`,
  'src/components/StatusChip.tsx': `export default function StatusChip() { return <span />; }`,
  'src/pages/cargo/index.tsx': `import CargoManifest from './CargoManifest'; export { default as HazardSummary } from './HazardSummary'; export default CargoManifest;`,
  'src/pages/cargo/CargoManifest.tsx': `import { getManifestLines } from '../../api/client'; import StatusChip from '../../components/StatusChip';
    export default function CargoManifest() { useEffect(() => { getManifestLines(); }, []); return <div />; }`,
  'src/pages/cargo/HazardSummary.tsx': `import { getManifestLines } from '../../api/client'; import { useAppState } from '../../store/AppContext';
    export default function HazardSummary() { const { dockings } = useAppState(); getManifestLines(); return <div />; }`,
  'src/store/AppContext.tsx': `import { getDockings, getTelemetry } from '../api/client';
    export function AppProvider() { const refresh = async () => { const [dockings, telemetry] = await Promise.all([getDockings(), getTelemetry()]); }; return null; }
    export function useAppState() { return useContext(AppContext); }`,
  'src/api/client.ts': `import axios from 'axios';
    const http = axios.create();
    const BASE = { harbormaster: '/api/harbormaster', stationOs: '/api/stationos' };
    async function hm(path: string) { return (await http.get(\`\${BASE.harbormaster}\${path}\`)).data; }
    async function sos(path: string) { return (await http.get(\`\${BASE.stationOs}\${path}\`)).data; }
    export const getDockings = () => hm('/dockings');
    export const getManifestLines = () => hm('/manifest_lines');
    export const getTelemetry = () => sos('/telemetry');`,
  'src/utils/dead.ts': `export const unused = 1;`,
};

describe('resolveModule', () => {
  const files = new Set(['src/a.ts', 'src/pages/cargo/index.tsx', 'src/b.tsx']);
  it('resolves extensions and index files, and leaves packages alone', () => {
    expect(resolveModule('src/x.ts', './a', files)).toBe('src/a.ts');
    expect(resolveModule('src/x.ts', './pages/cargo', files)).toBe('src/pages/cargo/index.tsx');
    expect(resolveModule('src/pages/cargo/index.tsx', '../../b', files)).toBe('src/b.tsx');
    expect(resolveModule('src/x.ts', 'react', files)).toBeNull();
  });
});

describe('buildSourceGraph', () => {
  const graph = project(APP);
  const node = (file: string) => graph.files.find((f) => f.file === file);

  it('resolves routes to component files through barrels and re-exports', () => {
    expect(graph.routes).toEqual([
      { path: '/cargo', elements: [
        { component: 'CargoManifest', file: 'src/pages/cargo/CargoManifest.tsx', container: 'main' },
        { component: 'HazardSummary', file: 'src/pages/cargo/HazardSummary.tsx', container: 'aside' },
      ] },
      { path: '/docking', elements: [{ component: 'DockingBoard', file: 'src/components/DockingBoard.tsx', container: 'main' }] },
    ]);
  });

  it('follows URLs through wrapper functions to concrete endpoints', () => {
    expect(node('src/pages/cargo/CargoManifest.tsx')?.endpoints).toEqual([{ method: 'GET', url: '/api/harbormaster/manifest_lines' }]);
    expect(node('src/api/client.ts')?.apiClient).toBe(true);
    expect(node('src/api/client.ts')?.endpoints).toEqual([
      { method: 'GET', url: '/api/harbormaster/dockings' },
      { method: 'GET', url: '/api/harbormaster/manifest_lines' },
      { method: 'GET', url: '/api/stationos/telemetry' },
    ]);
  });

  it('resolves store reads to the endpoints that load them — couplings no screen shows', () => {
    expect(node('src/pages/cargo/HazardSummary.tsx')?.storeReads).toEqual([
      { hook: 'useAppState', store: 'src/store/AppContext.tsx', field: 'dockings', endpoints: [{ method: 'GET', url: '/api/harbormaster/dockings' }] },
    ]);
    expect(node('src/layout/Sidebar.tsx')?.storeReads.map((r) => r.field)).toEqual(['telemetry']);
  });

  it('assigns every file to a screen, the shell, shared, or unreached', () => {
    const byCategory = Object.fromEntries(graph.files.map((f) => [f.file, f.assignment]));
    expect(byCategory['src/components/DockingBoard.tsx']).toEqual({ category: 'screen', screens: ['/docking'] });
    expect(byCategory['src/pages/cargo/HazardSummary.tsx']).toEqual({ category: 'screen', screens: ['/cargo'] });
    // The barrel only leads into the cargo screen.
    expect(byCategory['src/pages/cargo/index.tsx']).toEqual({ category: 'screen', screens: ['/cargo'] });
    expect(byCategory['src/components/StatusChip.tsx']).toEqual({ category: 'shared', screens: ['/cargo', '/docking'], shell: false });
    expect(byCategory['src/store/AppContext.tsx']).toEqual({ category: 'shared', screens: ['/cargo', '/docking'], shell: true });
    expect(byCategory['src/layout/Sidebar.tsx']).toEqual({ category: 'shell', screens: [] });
    expect(byCategory['src/App.tsx']).toEqual({ category: 'shell', screens: [] });
    expect(byCategory['src/utils/dead.ts']).toEqual({ category: 'unreached', screens: [] });
    expect(graph.entries).toEqual(['src/index.tsx']);
  });
});
