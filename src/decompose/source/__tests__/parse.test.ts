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

  // ---- patterns from the RealWorld corpus (#442) ---------------------------------

  it('parses JSX in a .js file, and reads React Router 4 component routes', () => {
    const facts = parse(
      'src/components/App.js',
      `export default function App() {
         return (<div><Switch>
           <Route exact path="/" component={Home}/>
           <Route path="/login" component={Login} />
         </Switch></div>);
       }`
    );
    expect(facts.components).toEqual(['App']);
    expect(facts.routes.map((r) => [r.path, r.element])).toEqual([
      ['/', 'Home'],
      ['/login', 'Login'],
    ]);
  });

  it('reads routes whose component is a child, through route wrappers (React Router 5)', () => {
    const facts = parse(
      'src/components/App/App.tsx',
      `export function App() {
         return (<HashRouter><Switch>
           <GuestOnlyRoute exact path='/login' userIsLogged={userIsLogged}><Login /></GuestOnlyRoute>
           <Route path='/article/:slug'><ArticlePage /></Route>
           <Route exact path='/'><Home /></Route>
         </Switch></HashRouter>);
       }`
    );
    expect(facts.routes.map((r) => [r.path, r.element])).toEqual([
      ['/login', 'Login'],
      ['/article/:slug', 'ArticlePage'],
      ['/', 'Home'],
    ]);
  });

  it('follows a superagent client through object-literal API methods and a default-exported object', () => {
    const facts = parse(
      'src/agent.js',
      `import superagentPromise from 'superagent-promise';
       import _superagent from 'superagent';
       const superagent = superagentPromise(_superagent, global.Promise);
       const API_ROOT = '/api';
       const requests = {
         get: url => superagent.get(\`\${API_ROOT}\${url}\`).then(res => res.body),
         del: url => superagent.del(\`\${API_ROOT}\${url}\`),
       };
       const Articles = {
         all: page => requests.get(\`/articles?\${limit(10, page)}\`),
         del: slug => requests.del(\`/articles/\${slug}\`),
       };
       export default { Articles, Tags: Articles };`
    );
    const fn = (name: string) => facts.functions.find((f) => f.name === name);
    expect(fn('requests.get')?.http).toEqual([{ method: 'GET', url: '/api{url}', line: 6 }]);
    expect(fn('requests.del')?.http).toEqual([{ method: 'DELETE', url: '/api{url}', line: 7 }]);
    expect(fn('Articles.all')?.calls).toContainEqual({ callee: 'requests.get', args: ['/articles?{?}'] });
    expect(fn('Articles.del')?.params).toEqual(['slug']);
    expect(facts.exports).toMatchObject({ 'default.Articles': 'Articles', 'default.Tags': 'Articles' });
  });

  it('records calls made through an object, as a component calls agent.Articles.all()', () => {
    const facts = parse(
      'src/components/Home/index.js',
      `import agent from '../../agent';
       class Home extends React.Component {
         componentWillMount() { this.props.onLoad(agent.Articles.all()); }
         render() { return <div />; }
       }
       export default Home;`
    );
    expect(facts.functions.find((f) => f.name === 'Home.componentWillMount')?.calls).toContainEqual({ callee: 'agent.Articles.all', args: [] });
  });

  it('sees through a higher-order component in the default export: connect(...)(Article), withRouter(X) (#442)', () => {
    const hoc = (exp: string) => parse('src/components/Article/index.js', `class Article extends React.Component { render() { return <div />; } }\n${exp}`).exports.default;
    expect(hoc('export default connect(mapStateToProps, mapDispatchToProps)(Article);')).toBe('Article');
    expect(hoc('export default withRouter(connect(null, mapDispatch)(Article));')).toBe('Article');
    expect(hoc('export default React.memo(Article);')).toBe('Article');
    expect(hoc('export default compose(a, b);')).toBe('<expression>');
  });
});
