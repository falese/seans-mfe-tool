/**
 * The deterministic first draft of a decomposition (ADR-110 §1a, #415).
 *
 * Same evidence in, same proposal out — so it can be tested, scored, and
 * improved in CI. Judgment (names, merges, splits) is the operating agent's,
 * recorded as edits to the `decomposition.yaml` this produces.
 *
 * 1. **Seeds.** Every route that puts a component in the primary area (the
 *    `main` landmark, or its only element) seeds a domain named after the
 *    route; the files only that route reaches join it.
 * 2. **Shell.** Files only the entry reaches form the shell domain.
 * 3. **Data affinity.** A component left over — rendered by the shell, or by a
 *    route with no primary area — joins the domain whose data it reads, when
 *    that domain supplies at least half of it. Chrome (navigation, headers,
 *    the file holding the route table) stays in the shell; its reads of other
 *    domains' data are flagged as couplings, not followed.
 * 4. **Shared** files keep no owner and get a suggestion instead.
 */

import type { Endpoint, FileNode, SourceGraph } from '../source/graph';
import type { History } from '../source/history';
import type { Join } from '../source/join';
import type { TestInventory } from '../source/tests';
import { backendOf, type BackendLayout } from './backends';
import type { Decomposition, Domain } from './model';
import { triageTests } from './triage';

export interface ProposeInput {
  appName: string;
  namespace: string;
  graph: SourceGraph;
  tests?: TestInventory;
  history?: History;
  join?: Join;
  /** One API or a gateway (`backendLayout`); a gateway when not given. */
  layout?: BackendLayout;
}

const SHELL_ID = 'shell';
const ep = (e: Endpoint) => `${e.method} ${e.url}`;

/** A route path's literal part as an id: `/article/:id` → `article`, `/` → `home`; '' when it has none (`/@:username`). */
export function slug(path: string): string {
  const s = path
    .split('/')
    .filter((p) => p && !p.includes(':') && p !== '*')
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  return s || (path.replace(/\/+$/, '') === '' ? 'home' : '');
}

export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export { backendOf };

/** Data a file uses: what it calls itself, plus what it reads from a store. */
function dataOf(f: FileNode): Set<string> {
  const out = new Set<string>();
  if (!f.apiClient) for (const e of f.endpoints) out.add(ep(e));
  for (const r of f.storeReads) for (const e of r.endpoints) out.add(ep(e));
  return out;
}

export function propose(input: ProposeInput): Decomposition {
  const { graph } = input;
  const byFile = new Map(graph.files.map((f) => [f.file, f]));
  const owner = new Map<string, string>(); // file → domain id
  const reasons = new Map<string, string[]>();
  const note = (domain: string, why: string) => (reasons.get(domain) ?? reasons.set(domain, []).get(domain))?.push(why);

  // ---- 1. seeds -------------------------------------------------------------------
  const routeFiles = new Set<string>();
  for (const r of graph.routes) for (const e of r.elements) if (e.file) routeFiles.add(e.file);
  // The primary area: the page in <main>, else a route's only page unless it renders into a side
  // landmark (a <div> around the <Switch> is no sidebar — #442).
  const SIDE = new Set(['aside', 'nav', 'header', 'footer']);
  const primaryOf = (r: SourceGraph['routes'][number]) =>
    r.elements.find((e) => e.container === 'main') ??
    (r.elements.length === 1 && !SIDE.has(r.elements[0].container ?? '') ? r.elements[0] : undefined);
  // One domain per route family (routes under one first segment, as the graph assigns files):
  // named for that segment, else for the page of its shortest route — `/@:username` → `profile` (#442).
  const familyOf = (p: string) => p.split('/').filter(Boolean)[0] ?? '';
  const familyIds = new Map<string, string>();
  for (const r of [...graph.routes].sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path))) {
    const k = familyOf(r.path);
    if (familyIds.has(k)) continue;
    const primary = primaryOf(r);
    const id = slug(`/${k}`) || (primary ? kebab(primary.component) : '');
    if (id) familyIds.set(k, id);
  }
  const idOf = (p: string) => familyIds.get(familyOf(p)) ?? (slug(p) || 'screen');

  const seeds = new Map<string, string>(); // route path → domain id
  for (const r of graph.routes) {
    const primary = primaryOf(r);
    if (!primary?.file) continue;
    seeds.set(r.path, idOf(r.path));
    note(idOf(r.path), `route ${r.path} places ${primary.component} in the primary area`);
  }
  for (const f of graph.files) {
    const a = f.assignment;
    if (a.category === 'screen' && seeds.has(a.screens[0])) owner.set(f.file, seeds.get(a.screens[0]) as string);
  }

  // ---- 2. shell; chrome ----------------------------------------------------------
  const routeTableFiles = new Set(graph.files.filter((f) => f.landmarks.includes('main') && graph.routes.length > 0).map((f) => f.file));
  const isChrome = (f: FileNode) =>
    graph.entries.includes(f.file) ||
    routeTableFiles.has(f.file) ||
    f.landmarks.some((l) => l === 'nav' || l === 'header' || l === 'footer');

  // ---- 3. data affinity for whatever is left -------------------------------------
  const domainData = (id: string) => {
    const out = new Set<string>();
    for (const [file, d] of owner) if (d === id) dataOf(byFile.get(file) as FileNode).forEach((x) => out.add(x));
    return out;
  };
  const seedIds = [...new Set(seeds.values())];
  for (const f of graph.files) {
    if (owner.has(f.file)) continue;
    const a = f.assignment;
    if (a.category === 'shared' || a.category === 'unreached') continue;
    const mine = dataOf(f);
    if (!isChrome(f) && mine.size > 0) {
      let best: { id: string; share: number } | null = null;
      for (const id of seedIds) {
        const theirs = domainData(id);
        const share = [...mine].filter((x) => theirs.has(x)).length / mine.size;
        if (share > (best?.share ?? 0)) best = { id, share };
      }
      if (best && best.share >= 0.5) {
        owner.set(f.file, best.id);
        note(best.id, `${f.file} reads ${Math.round(best.share * 100)}% of its data from this domain's endpoints`);
        continue;
      }
    }
    if (a.category === 'screen' && !seeds.has(a.screens[0])) {
      // A route with no primary area and no data home: a domain of its own.
      owner.set(f.file, idOf(a.screens[0]));
      note(idOf(a.screens[0]), `route ${a.screens[0]} has no primary area; ${f.file} has no data home elsewhere`);
      continue;
    }
    owner.set(f.file, SHELL_ID);
  }
  note(SHELL_ID, 'files reached only from the entry: the layout every domain composes into');

  // ---- domains ------------------------------------------------------------------------
  const ids = [...new Set(owner.values())].sort((a, b) => (a === SHELL_ID ? -1 : b === SHELL_ID ? 1 : a.localeCompare(b)));
  const domainOf = (file: string | null) => (file ? (owner.get(file) ?? null) : null);

  // Which domain owns an endpoint: the one whose files use it most.
  const endpointOwner = new Map<string, string>();
  {
    const counts = new Map<string, Map<string, number>>();
    for (const [file, d] of owner) {
      if (d === SHELL_ID) continue;
      for (const x of dataOf(byFile.get(file) as FileNode)) {
        const m = counts.get(x) ?? counts.set(x, new Map()).get(x) as Map<string, number>;
        m.set(d, (m.get(d) ?? 0) + 1);
      }
    }
    for (const [x, m] of counts) {
      endpointOwner.set(x, [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
    }
  }

  // Slots, routes and repeated placements.
  const shellFiles = new Set([...owner].filter(([, d]) => d === SHELL_ID).map(([f]) => f));
  const slotsUsed = new Map<string, boolean>();
  const routes: Decomposition['routes'] = [];
  // Parameters keep their name, so `/editor` and `/editor/:slug` get different keys (#442).
  const stateKey = (path: string) => {
    const parts = path
      .split('/')
      .filter((p) => p && p !== '*')
      .map((p) => p.replace(/^@?:/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-'))
      .filter(Boolean);
    return parts.length === 0 ? `${input.namespace}.root` : `${input.namespace}.open.${parts.join('.')}`;
  };
  for (const r of graph.routes) {
    const place = r.elements
      .filter((e) => e.file && domainOf(e.file))
      .map((e) => {
        const slot = e.container ?? 'main';
        slotsUsed.set(slot, false);
        return { capability: e.component, domain: domainOf(e.file) as string, slot };
      });
    if (place.length > 0) routes.push({ path: r.path, stateKey: stateKey(r.path), place });
  }
  const repeated: Decomposition['repeated'] = [];
  for (const file of [...shellFiles].sort()) {
    for (const r of (byFile.get(file) as FileNode).renders) {
      const d = domainOf(r.file);
      if (!r.file || !d || d === SHELL_ID) continue;
      const slot = r.repeated ? `${kebab(r.component)}.{id}` : kebab(r.component);
      slotsUsed.set(slot, r.repeated);
      repeated.push({ capability: r.component, domain: d, slot, renderedBy: file });
    }
  }

  const shellCapability = graph.files.find((f) => routeTableFiles.has(f.file) && f.components.length > 0);
  const domains: Domain[] = ids.map((id) => {
    const files = [...owner].filter(([, d]) => d === id).map(([f]) => f).sort();
    const placed = [
      ...routes.flatMap((r) => r.place).filter((p) => p.domain === id),
      ...repeated.filter((p) => p.domain === id),
    ];
    const capabilities = [...new Map(placed.map((p) => [p.capability, p])).keys()].map((name) => {
      const file = files.find((f) => byFile.get(f)?.components.includes(name)) ?? files[0];
      return { name, file, component: name };
    });
    if (id === SHELL_ID && shellCapability) {
      capabilities.unshift({ name: shellCapability.components[0], file: shellCapability.file, component: shellCapability.components[0] });
    }
    const endpoints = new Set<string>();
    if (id !== SHELL_ID) for (const f of files) dataOf(byFile.get(f) as FileNode).forEach((x) => endpoints.add(x));
    const sortedEndpoints = [...endpoints].sort();
    return {
      id,
      mfe: `${input.appName}-${id}`,
      shell: id === SHELL_ID,
      files,
      capabilities,
      backends: [...new Set(sortedEndpoints.map((x) => backendOf(x.split(' ')[1], input.layout)))].sort(),
      endpoints: sortedEndpoints,
      evidence: evidenceFor(id, files, input, owner, endpointOwner),
      reasons: reasons.get(id) ?? [],
    };
  });

  // ---- shared, couplings ---------------------------------------------------------------
  const storeFiles = new Set(graph.files.flatMap((f) => f.storeReads.map((r) => r.store)));
  const importers = (file: string) => graph.files.filter((f) => f.imports.includes(file)).map((f) => domainOf(f.file)).filter((d): d is string => !!d);
  const shared = graph.files
    .filter((f) => f.assignment.category === 'shared')
    .map((f) => ({
      file: f.file,
      usedBy: [...new Set(importers(f.file))].sort(),
      suggestion: f.apiClient
        ? 'replace with one BFF per domain, each fronting only the backends its screens call'
        : storeFiles.has(f.file)
          ? 'dissolve: each domain loads its own data through its BFF'
          : f.components.length > 0
            ? 'duplicate per domain, or move to a shared component library'
            : 'split by domain',
    }));

  const couplings: Decomposition['couplings'] = [];
  for (const [file, d] of [...owner].sort()) {
    for (const read of (byFile.get(file) as FileNode).storeReads) {
      for (const e of read.endpoints) {
        const o = endpointOwner.get(ep(e));
        if (!o || o === d) continue;
        couplings.push({
          file,
          domain: d,
          field: read.field,
          endpoint: ep(e),
          owner: o,
          kind: d === SHELL_ID ? 'shell-read' : 'store-read',
          note:
            d === SHELL_ID
              ? `the shell shows ${o} data; drop it, or have ${o} provide it through the composition`
              : `${d} reads ${o}'s ${read.field} from the shared store; its BFF should source it itself`,
        });
      }
    }
  }

  const tests = input.tests ? triageTests(input.tests, (file) => domainOf(file)) : [];
  const kept = new Set(tests.filter((t) => t.verdict === 'keep').flatMap((t) => input.tests?.files.find((f) => f.file === t.file)?.touches ?? []));
  const uncovered = domains.flatMap((d) =>
    d.capabilities.filter((c) => !kept.has(c.file)).map((c) => ({ capability: c.name, domain: d.id, file: c.file, reason: 'no kept test exercises it' }))
  );

  return {
    version: 1,
    app: { name: input.appName, namespace: input.namespace, gateway: input.layout?.gateway ?? true },
    domains,
    shared,
    unassigned: graph.files.filter((f) => f.assignment.category === 'unreached').map((f) => f.file),
    couplings,
    slots: [...slotsUsed].map(([id, rep]) => ({ id, provider: SHELL_ID, repeated: rep })).sort((a, b) => a.id.localeCompare(b.id)),
    routes,
    repeated,
    tests,
    uncovered,
  };
}

function evidenceFor(
  id: string,
  files: string[],
  input: ProposeInput,
  owner: Map<string, string>,
  endpointOwner: Map<string, string>
): Domain['evidence'] {
  const byFile = new Map(input.graph.files.map((f) => [f.file, f]));
  const set = new Set(files);
  const ratio = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100) / 100);

  const route = ratio(files.filter((f) => byFile.get(f)?.assignment.category === 'screen').length, files.length);
  const data = [...new Set(files.flatMap((f) => [...dataOf(byFile.get(f) as FileNode)]))];
  const dataScore = id === SHELL_ID ? null : ratio(data.filter((x) => endpointOwner.get(x) === id).length, data.length);
  const edges = files.flatMap((f) => byFile.get(f)?.imports ?? []);
  const imports = ratio(edges.filter((t) => set.has(t) || byFile.get(t)?.assignment.category === 'shared').length, edges.length);
  const runtime = input.join ? ratio(files.filter((f) => input.join?.files[f]).length, files.length) : null;
  const pairs = (input.history?.coChange ?? []).filter((p) => set.has(p.a) || set.has(p.b));
  const cochange = pairs.length > 0 ? ratio(pairs.filter((p) => set.has(p.a) && set.has(p.b)).length, pairs.length) : null;
  const owners = files.map((f) => (input.history?.owners[f] ?? []).join(',')).filter(Boolean);
  const top = owners.length > 0 ? [...new Set(owners)].map((o) => owners.filter((x) => x === o).length).sort((a, b) => b - a)[0] : 0;
  const ownership = owners.length > 0 ? ratio(top, files.length) : null;
  void owner;
  return { route, data: dataScore, imports, runtime, cochange, ownership };
}
