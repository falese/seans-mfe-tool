import * as ts from 'typescript';
import { parseFile } from '../parse';

const parse = (file: string, text: string) => parseFile(ts, file, text);

describe('parseFile', () => {
  it('records imports, re-exports and exports', () => {
    const facts = parse(
      'src/pages/cargo/index.tsx',
      `import CargoManifest from './CargoManifest';
       import type { Docking } from '../../types';
       import * as helpers from '../../utils/helpers';
       export { default as HazardSummary } from './HazardSummary';
       export * from './shared';
       export const PAGE = 'cargo';
       export default CargoManifest;`
    );
    expect(facts.imports).toEqual([
      { spec: './CargoManifest', names: [{ imported: 'default', local: 'CargoManifest' }], typeOnly: false },
      { spec: '../../types', names: [{ imported: 'Docking', local: 'Docking' }], typeOnly: true },
      { spec: '../../utils/helpers', names: [{ imported: '*', local: 'helpers' }], typeOnly: false },
    ]);
    expect(facts.reexports).toEqual([
      { spec: './HazardSummary', names: [{ exported: 'HazardSummary', imported: 'default' }] },
      { spec: './shared', names: '*' },
    ]);
    expect(facts.exports).toEqual({ PAGE: 'PAGE', default: 'CargoManifest' });
    expect(facts.bootstraps).toBe(false);
  });

  it('marks a file that mounts the app as an entry point', () => {
    expect(parse('src/index.tsx', `createRoot(document.getElementById('root')!).render(<App />);`).bootstraps).toBe(true);
    expect(parse('src/main.jsx', `ReactDOM.render(<App />, el);`).bootstraps).toBe(true);
    expect(parse('src/x.tsx', `export function F() { return root.render(<App />); }`).bootstraps).toBe(false);
    // A Babylon engine's render loop is not React mounting the app.
    expect(parse('src/sim/GameEngine.ts', `export class GameEngine { start() { this.engine.runRenderLoop(() => this.scene.render()); } }`).bootstraps).toBe(false);
  });

  it('treats class methods as functions, so a class-based client is seen', () => {
    const facts = parse('src/api/Api.ts', `export class Api { load() { return fetch('/api/x'); } }`);
    expect(facts.functions.find((f) => f.name === 'Api.load')?.http).toEqual([{ method: 'GET', url: '/api/x', line: 1 }]);
  });

  it('finds components: capitalised functions that return JSX', () => {
    const facts = parse(
      'src/components/X.tsx',
      `export default function DockingBoard() { return <table />; }
       export const BerthTile = ({ id }: { id: string }) => <div>{id}</div>;
       function helper() { return 1; }
       const Lower = () => null;`
    );
    expect(facts.components).toEqual(['DockingBoard', 'BerthTile']);
    expect(facts.exports).toEqual({ default: 'DockingBoard', BerthTile: 'BerthTile' });
  });

  it('reads React Router routes with the landmark they render into', () => {
    const facts = parse(
      'src/App.tsx',
      `export default function App() {
         return (<div>
           <main><Routes>
             <Route path="/" element={null} />
             <Route path="/docking" element={<DockingBoard />} />
           </Routes></main>
           <aside><Routes><Route path="/docking" element={<TrafficLog />} /><Route path="*" element={null} /></Routes></aside>
         </div>);
       }`
    );
    expect(facts.routes).toEqual([
      { path: '/', element: null, container: 'main', line: 4 },
      { path: '/docking', element: 'DockingBoard', container: 'main', line: 5 },
      { path: '/docking', element: 'TrafficLog', container: 'aside', line: 7 },
      { path: '*', element: null, container: 'aside', line: 7 },
    ]);
  });

  it('reads object route configs', () => {
    const facts = parse(
      'src/router.tsx',
      `const router = createBrowserRouter([{ path: '/crew', element: <CrewRoster /> }, { path: '/x', Component: Other }]);`
    );
    expect(facts.routes.map((r) => [r.path, r.element])).toEqual([
      ['/crew', 'CrewRoster'],
      ['/x', 'Other'],
    ]);
  });

  it('folds HTTP call URLs to templates, with parameters as placeholders', () => {
    const facts = parse(
      'src/api/client.ts',
      `import axios from 'axios';
       const http = axios.create({ timeout: 10000 });
       const BASE = { harbormaster: '/api/harbormaster', ledger: '/api/ledger' };
       async function hm(path: string) { const res = await http.get(\`\${BASE.harbormaster}\${path}\`); return res.data; }
       export const getBerths = () => hm('/berths');
       export const getDocking = (id: string) => hm('/dockings/' + id);
       export async function save(body: unknown) { return fetch('/api/ledger/charges', { method: 'POST', body: JSON.stringify(body) }); }
       export const ping = () => axios.get(BASE.ledger + '/health');`
    );
    const fn = (name: string) => facts.functions.find((f) => f.name === name);
    expect(fn('hm')?.http).toEqual([{ method: 'GET', url: '/api/harbormaster{path}', line: 4 }]);
    expect(fn('hm')?.params).toEqual(['path']);
    expect(fn('getBerths')?.calls).toEqual([{ callee: 'hm', args: ['/berths'] }]);
    expect(fn('getDocking')?.calls).toEqual([{ callee: 'hm', args: ['/dockings/{id}'] }]);
    expect(fn('save')?.http).toEqual([{ method: 'POST', url: '/api/ledger/charges', line: 7 }]);
    expect(fn('ping')?.http).toEqual([{ method: 'GET', url: '/api/ledger/health', line: 8 }]);
  });

  it('records which store fields are loaded by which calls, and which fields a hook consumer reads', () => {
    const store = parse(
      'src/store/AppContext.tsx',
      `export function AppProvider() {
         const refresh = async () => {
           const [berths, dockings] = await Promise.all([getBerths(), getDockings()]);
           const modules = await getModules();
         };
       }
       export function useAppState() { return useContext(AppContext); }`
    );
    expect(store.storeLoads).toEqual([
      { field: 'berths', callee: 'getBerths' },
      { field: 'dockings', callee: 'getDockings' },
      { field: 'modules', callee: 'getModules' },
    ]);
    expect(store.hooks).toEqual(['useAppState']);

    const consumer = parse(
      'src/pages/cargo/HazardSummary.tsx',
      `export default function HazardSummary() { const { dockings, error } = useAppState(); return <div />; }`
    );
    expect(consumer.hookReads).toEqual([{ hook: 'useAppState', fields: ['dockings', 'error'] }]);
  });

  it('records the landmarks a file renders and the components it renders, repeated or once', () => {
    const facts = parse(
      'src/layout/BerthStrip.tsx',
      `export default function BerthStrip({ berths }) {
         return (<header><nav><Logo /></nav>{berths.map((b) => <BerthTile key={b.id} id={b.id} />)}</header>);
       }`
    );
    expect(facts.landmarks).toEqual(['header', 'nav']);
    expect(facts.renders).toEqual([
      { component: 'Logo', repeated: false },
      { component: 'BerthTile', repeated: true },
    ]);
  });
});
