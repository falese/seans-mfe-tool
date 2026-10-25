import * as ts from 'typescript';
import { parseFile } from '../parse';
import { apiBaseOf, buildSourceGraph, resolveModule, resolveRelativeUrls } from '../graph';

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

  it('resolves rendered components to their files, keeping whether they repeat', () => {
    const g = project({
      'src/index.tsx': `import Strip from './Strip'; createRoot(el).render(<Strip />);`,
      'src/Strip.tsx': `import Tile from './Tile'; export default function Strip() { return <header>{[1].map((i) => <Tile key={i} />)}</header>; }`,
      'src/Tile.tsx': `export default function Tile() { return <div />; }`,
    });
    const strip = g.files.find((f) => f.file === 'src/Strip.tsx');
    expect(strip?.landmarks).toEqual(['header']);
    expect(strip?.renders).toEqual([{ component: 'Tile', file: 'src/Tile.tsx', repeated: true }]);
  });

  it('follows calls through objects across modules: agent.Articles.all() → requests.get → superagent (#442)', () => {
    const graph = project({
      'src/index.js': `import App from './components/App'; ReactDOM.render(<App />, document.getElementById('root'));`,
      'src/agent.js': `
        import _superagent from 'superagent';
        const superagent = wrap(_superagent);
        const API_ROOT = '/api';
        const requests = { get: url => superagent.get(\`\${API_ROOT}\${url}\`) };
        const Articles = { all: page => requests.get(\`/articles?\${limit(10, page)}\`), get: slug => requests.get(\`/articles/\${slug}\`) };
        const Tags = { getAll: () => requests.get('/tags') };
        export default { Articles, Tags };`,
      'src/components/App.js': `import Home from './Home'; export default function App() { return <Switch><Route exact path="/" component={Home} /></Switch>; }`,
      'src/components/Home/index.js': `
        import agent from '../../agent';
        class Home extends React.Component {
          componentWillMount() { this.props.onLoad(Promise.all([agent.Tags.getAll(), agent.Articles.all()])); }
          render() { return <div />; }
        }
        export default Home;`,
    });
    const home = graph.files.find((f) => f.file === 'src/components/Home/index.js');
    expect(home?.endpoints).toEqual([
      { method: 'GET', url: '/api/articles?{?}' },
      { method: 'GET', url: '/api/tags' },
    ]);
    expect(home?.assignment).toEqual({ category: 'screen', screens: ['/'] });
  });

  it('resolves URLs relative to an HTTP client baseURL against the base the traffic shows (#442)', () => {
    expect(apiBaseOf(['/api/tags', '/api/articles?limit=10', '/api/user'])).toBe('/api/');
    expect(apiBaseOf(['/tags', '/v2/x'])).toBe('/');
    const graph = project({
      'src/index.tsx': `import App from './App'; render(<App />);`,
      'src/App.tsx': `import { getTags } from './conduit'; export default function App() { useEffect(() => { getTags(); }, []); return <div />; }`,
      'src/conduit.ts': `import axios from 'axios'; axios.defaults.baseURL = settings.baseApiUrl;
        export async function getTags() { return (await axios.get('tags')).data; }
        export async function getFeed() { return axios.get(\`articles/feed?\${q}\`); }
        export const ping = () => axios.get('/health');`,
    });
    const resolved = resolveRelativeUrls(graph, '/api/');
    expect(resolved.files.find((f) => f.file === 'src/App.tsx')?.endpoints).toEqual([{ method: 'GET', url: '/api/tags' }]);
    expect(resolved.files.find((f) => f.file === 'src/conduit.ts')?.endpoints.map((e) => e.url)).toEqual(['/api/articles/feed?{?}', '/api/tags', '/health']);
  });

  it('gives a slice to its screen when the shell reaches it only through a store that registers every slice (#442)', () => {
    const graph = project({
      'src/index.tsx': `import App from './App'; import { store } from './store'; render(<App />);`,
      'src/store.ts': `import home from './Home.slice'; import login from './Login.slice'; import { api } from './api'; export const store = configureStore({ reducer: { home, login } });`,
      'src/api.ts': `export const api = 1;`,
      'src/App.tsx': `import Home from './Home'; import Login from './Login';
        export default function App() { return <main><Routes><Route path="/" element={<Home />} /><Route path="/login" element={<Login />} /></Routes></main>; }`,
      'src/Home.tsx': `import { load } from './Home.slice'; import { api } from './api'; export default function Home() { return <div />; }`,
      'src/Home.slice.ts': `export const load = 1; export default 1;`,
      'src/Login.tsx': `import { submit } from './Login.slice'; import { api } from './api'; export default function Login() { return <form />; }`,
      'src/Login.slice.ts': `export const submit = 1; export default 1;`,
    });
    const a = (file: string) => graph.files.find((f) => f.file === file)?.assignment;
    expect(a('src/Home.slice.ts')).toEqual({ category: 'screen', screens: ['/'] });
    expect(a('src/Login.slice.ts')).toEqual({ category: 'screen', screens: ['/login'] });
    // Used by both screens and the shell directly: still shared.
    expect(a('src/api.ts')).toMatchObject({ category: 'shared' });
  });

  it('does not let a screen reach every slice through the store it imports (#442)', () => {
    const graph = project({
      'src/index.tsx': `import App from './App'; render(<App />);`,
      'src/store.ts': `import home from './Home.slice'; import login from './Login.slice'; export const store = configureStore({ reducer: { home, login } });`,
      'src/hooks.ts': `import { store } from './store'; export const useStore = () => store;`,
      'src/App.tsx': `import Home from './Home'; import Login from './Login';
        export default function App() { return <main><Routes><Route path="/" element={<Home />} /><Route path="/login" element={<Login />} /></Routes></main>; }`,
      'src/Home.tsx': `import { load } from './Home.slice'; import { useStore } from './hooks'; export default function Home() { return <div />; }`,
      'src/Home.slice.ts': `export const load = 1; export default 1;`,
      'src/Login.tsx': `import { submit } from './Login.slice'; import { useStore } from './hooks'; export default function Login() { return <form />; }`,
      'src/Login.slice.ts': `export const submit = 1; export default 1;`,
    });
    const a = (file: string) => graph.files.find((f) => f.file === file)?.assignment;
    expect(a('src/Home.slice.ts')).toEqual({ category: 'screen', screens: ['/'] });
    expect(a('src/Login.slice.ts')).toEqual({ category: 'screen', screens: ['/login'] });
    expect(a('src/store.ts')).toMatchObject({ category: 'shared' });
  });

  it('treats a route to the component that declares the routes as the frame, not a screen (#442)', () => {
    const graph = project({
      'src/index.js': `import App from './App'; ReactDOM.render(<Router><Route path="/" component={App} /></Router>, root);`,
      'src/App.js': `import Home from './Home'; import Login from './Login'; import Header from './Header';
        export default function App() { return <div><Header /><Switch><Route exact path="/" component={Home} /><Route path="/login" component={Login} /></Switch></div>; }`,
      'src/Header.js': `export default function Header() { return <nav />; }`,
      'src/Home.js': `export default function Home() { return <div />; }`,
      'src/Login.js': `export default function Login() { return <form />; }`,
    });
    const a = (file: string) => graph.files.find((f) => f.file === file)?.assignment;
    expect(a('src/Home.js')).toEqual({ category: 'screen', screens: ['/'] });
    expect(a('src/Header.js')).toEqual({ category: 'shell', screens: [] });
    expect(a('src/App.js')).toEqual({ category: 'shell', screens: [] });
  });

  it('treats routes under one first segment as one screen family: /editor and /editor/:slug (#442)', () => {
    const graph = project({
      'src/index.js': `import App from './App'; ReactDOM.render(<App />, root);`,
      'src/App.js': `import Editor from './Editor'; import Profile from './Profile'; import Favorites from './Favorites';
        export default function App() { return <main><Switch>
          <Route path="/editor/:slug" component={Editor} /><Route path="/editor" component={Editor} />
          <Route path="/@:username/favorites" component={Favorites} /><Route path="/@:username" component={Profile} />
        </Switch></main>; }`,
      'src/Editor.js': `export default function Editor() { return <form />; }`,
      'src/Profile.js': `export default function Profile() { return <div />; }`,
      'src/Favorites.js': `import Profile from './Profile'; export default function Favorites() { return <Profile />; }`,
    });
    const a = (file: string) => graph.files.find((f) => f.file === file)?.assignment;
    expect(a('src/Editor.js')).toEqual({ category: 'screen', screens: ['/editor'] });
    expect(a('src/Profile.js')).toEqual({ category: 'screen', screens: ['/@:username'] });
  });
});
