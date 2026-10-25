import * as ts from 'typescript';
import { parseFile } from '../../source/parse';
import { buildSourceGraph } from '../../source/graph';
import { propose, slug } from '../cluster';
import { DecompositionSchema } from '@seans-mfe/decompose';

const graph = buildSourceGraph(
  Object.entries({
    'src/index.tsx': `import App from './App'; render(<App />);`,
    'src/App.tsx': `import Tags from './Tags'; export default function App() { return <main><Routes><Route path="/tags" element={<Tags />} /></Routes></main>; }`,
    'src/api.ts': `export const getTags = () => fetch('/api/tags'); export const getComments = () => fetch('/api/articles/x/comments');`,
    'src/Tags.tsx': `import { getTags, getComments } from './api'; export default function Tags() { useEffect(() => { getTags(); getComments(); }, []); return <ul />; }`,
  }).map(([file, text]) => parseFile(ts, file, text))
);

describe('propose under one API (#442)', () => {
  it('names one backend for the API, and records the layout on the proposal', () => {
    const doc = propose({ appName: 'conduit', namespace: 'conduit', graph, layout: { gateway: false } });
    expect(doc.app).toEqual({ name: 'conduit', namespace: 'conduit', gateway: false });
    expect(doc.domains.find((d) => d.files.includes('src/Tags.tsx'))?.backends).toEqual(['api']);
  });
  it('reads a gateway by default, and a proposal without the field stays valid', () => {
    const doc = propose({ appName: 'conduit', namespace: 'conduit', graph });
    expect(doc.app.gateway).toBe(true);
    expect(doc.domains.find((d) => d.files.includes('src/Tags.tsx'))?.backends).toEqual(['articles', 'tags']);
    expect(DecompositionSchema.parse({ ...doc, app: { name: 'x', namespace: 'x' } }).app.gateway).toBe(true);
  });
});

describe('slug (#442)', () => {
  it('drops parameters however they are written, so /@:username has no literal part', () => {
    expect(slug('/@:username/favorites')).toBe('favorites');
    expect(slug('/@:username')).toBe('');
    expect(slug('/article/:id')).toBe('article');
    expect(slug('/')).toBe('home');
  });
});

describe('domains for route families (#442)', () => {
  const family = buildSourceGraph(
    Object.entries({
      'src/index.js': `import App from './App'; ReactDOM.render(<App />, root);`,
      'src/App.js': `import Home from './Home'; import Profile from './Profile'; import Favorites from './Favorites';
        export default function App() { return <main><Switch>
          <Route exact path="/" component={Home} />
          <Route path="/@:username/favorites" component={Favorites} /><Route path="/@:username" component={Profile} />
        </Switch></main>; }`,
      'src/Home.js': `export default function Home() { return <div />; }`,
      'src/Profile.js': `export default function Profile() { return <div />; }`,
      'src/Favorites.js': `import Profile from './Profile'; export default function Favorites() { return <Profile />; }`,
    }).map(([file, text]) => parseFile(ts, file, text))
  );
  it('names a family with no literal path after its page, and keeps its routes together', () => {
    const doc = propose({ appName: 'conduit', namespace: 'conduit', graph: family });
    expect(doc.domains.map((d) => [d.id, d.files])).toEqual([
      ['shell', ['src/App.js', 'src/index.js']],
      ['home', ['src/Home.js']],
      ['profile', ['src/Favorites.js', 'src/Profile.js']],
    ]);
  });
  it('gives every route its own state key, parameters named — none empty, none shared', () => {
    const doc = propose({ appName: 'conduit', namespace: 'conduit', graph: family });
    expect(doc.routes.map((r) => [r.path, r.stateKey])).toEqual([
      ['/', 'conduit.root'],
      ['/@:username', 'conduit.open.username'],
      ['/@:username/favorites', 'conduit.open.username.favorites'],
    ]);
  });
});

describe('the primary area without a <main> (#442)', () => {
  it('takes a route’s only page as primary when its <Switch> sits in a plain element, not a sidebar', () => {
    const g = buildSourceGraph(
      Object.entries({
        'src/index.js': `import App from './App'; ReactDOM.render(<App />, root);`,
        'src/App.js': `import Profile from './Profile'; import Favorites from './Favorites';
          export default function App() { return <div><Switch><Route path="/@:username/favorites" component={Favorites} /><Route path="/@:username" component={Profile} /></Switch></div>; }`,
        'src/Profile.js': `export default function Profile() { return <div />; }`,
        'src/Favorites.js': `import Profile from './Profile'; export default function Favorites() { return <Profile />; }`,
      }).map(([file, text]) => parseFile(ts, file, text))
    );
    const doc = propose({ appName: 'conduit', namespace: 'conduit', graph: g });
    expect(doc.domains.map((d) => d.id)).toEqual(['shell', 'profile']);
  });
});
