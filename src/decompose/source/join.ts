/**
 * Runtime evidence joined to the source graph (ADR-109 §3, #414): both
 * describe the same units — source files — so each can check the other.
 *
 * - Every endpoint the capture observed is matched to the source that calls
 *   it: the client that defines it, the files that call it directly, and the
 *   files that read it from a store. An observed endpoint nothing in source
 *   explains is a gap in the analysis.
 * - Endpoints the source can call but no journey exercised are listed, which
 *   is what the journeys missed.
 * - Each file gets what the capture saw of it: its regions, the paths they
 *   appeared on, and the requests attributed to them.
 */

import type { Endpoint, SourceGraph } from './graph';

export interface EvidenceRequest {
  method: string;
  url: string;
  attributedTo: Array<{ region: string; via: string }>;
}

export interface EvidenceStep {
  path: string;
  regions: Array<{ id: string; component: string; file: string | null }>;
}

export interface Evidence {
  requests: EvidenceRequest[];
  steps: EvidenceStep[];
}

export interface JoinedEndpoint extends Endpoint {
  observed: number;
  /** The source URL template that matched, or null when nothing in source explains it. */
  template: string | null;
  clients: string[];
  callers: string[];
  storeReaders: string[];
}

export interface JoinedFile {
  components: string[];
  paths: string[];
  /** Observed endpoints attributed to this file's regions, and by which signal. */
  endpoints: Array<{ method: string; url: string; via: string }>;
}

export interface Join {
  endpoints: JoinedEndpoint[];
  /** In source, never observed: what the journeys did not exercise. */
  sourceOnly: Array<Endpoint & { files: string[] }>;
  files: Record<string, JoinedFile>;
  summary: {
    observedEndpoints: number;
    explained: number;
    unexplained: number;
    sourceOnly: number;
    filesSeenAtRuntime: number;
    sourceFiles: number;
  };
}

function templateRegExp(template: string): RegExp {
  const parts = template.split(/(\{[^}]*\})/);
  const re = parts
    .map((p) => (p === '{?}' ? '.*' : /^\{.*\}$/.test(p) ? '[^/]+' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${re}$`);
}

const pathOf = (url: string) => url.replace(/[?#].*$/, '');

export function joinEvidence(graph: SourceGraph, evidence: Evidence): Join {
  // Every endpoint template in source, with the files that define, call or read it.
  const templates = new Map<string, { ep: Endpoint; clients: Set<string>; callers: Set<string>; storeReaders: Set<string> }>();
  const slot = (ep: Endpoint) => {
    const k = `${ep.method} ${ep.url}`;
    if (!templates.has(k)) templates.set(k, { ep, clients: new Set(), callers: new Set(), storeReaders: new Set() });
    return templates.get(k) as { ep: Endpoint; clients: Set<string>; callers: Set<string>; storeReaders: Set<string> };
  };
  for (const f of graph.files) {
    for (const ep of f.endpoints) (f.apiClient ? slot(ep).clients : slot(ep).callers).add(f.file);
    for (const read of f.storeReads) for (const ep of read.endpoints) slot(ep).storeReaders.add(f.file);
  }
  // Observed URLs are compared without their query, so templates are too: `/articles?{?}` → `/articles`
  // (#442). An unresolved part (`{?}`) is not a query.
  const templatePath = (url: string) => pathOf(url.replace(/\{\?\}/g, '⟨unresolved⟩')).replace(/⟨unresolved⟩/g, '{?}');
  const compiled = [...templates.values()].map((t) => ({ ...t, re: templateRegExp(templatePath(t.ep.url)) }));

  // Observed endpoints, by method and path.
  const observed = new Map<string, { method: string; url: string; count: number }>();
  for (const r of evidence.requests) {
    const url = pathOf(r.url);
    const k = `${r.method} ${url}`;
    const o = observed.get(k) ?? { method: r.method, url, count: 0 };
    o.count += 1;
    observed.set(k, o);
  }

  const used = new Set<string>();
  const endpoints: JoinedEndpoint[] = [...observed.values()]
    .map((o): JoinedEndpoint => {
      // Prefer the most literal template: fewest placeholders.
      const match = compiled
        .filter((t) => t.ep.method === o.method && t.re.test(o.url))
        .sort((a, b) => (a.ep.url.match(/\{/g) ?? []).length - (b.ep.url.match(/\{/g) ?? []).length)[0];
      if (match) used.add(`${match.ep.method} ${match.ep.url}`);
      return {
        method: o.method,
        url: o.url,
        observed: o.count,
        template: match?.ep.url ?? null,
        clients: match ? [...match.clients].sort() : [],
        callers: match ? [...match.callers].sort() : [],
        storeReaders: match ? [...match.storeReaders].sort() : [],
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method));

  const sourceOnly = compiled
    .filter((t) => !used.has(`${t.ep.method} ${t.ep.url}`) && !t.ep.url.includes('{?}'))
    .map((t) => ({ ...t.ep, files: [...new Set([...t.clients, ...t.callers, ...t.storeReaders])].sort() }))
    .sort((a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method));

  // What the capture saw of each file.
  const regionFile = new Map<string, string>();
  const files: Record<string, JoinedFile> = {};
  const fileEntry = (file: string) => (files[file] ??= { components: [], paths: [], endpoints: [] });
  for (const step of evidence.steps) {
    for (const region of step.regions) {
      if (!region.file) continue;
      regionFile.set(region.id, region.file);
      const entry = fileEntry(region.file);
      if (!entry.components.includes(region.component)) entry.components.push(region.component);
      if (!entry.paths.includes(step.path)) entry.paths.push(step.path);
    }
  }
  for (const r of evidence.requests) {
    for (const a of r.attributedTo) {
      const file = regionFile.get(a.region) ?? null;
      if (!file) continue;
      const entry = fileEntry(file);
      const url = pathOf(r.url);
      if (!entry.endpoints.some((e) => e.method === r.method && e.url === url && e.via === a.via)) {
        entry.endpoints.push({ method: r.method, url, via: a.via });
      }
    }
  }
  for (const entry of Object.values(files)) {
    entry.components.sort();
    entry.paths.sort();
    entry.endpoints.sort((a, b) => a.url.localeCompare(b.url) || a.via.localeCompare(b.via));
  }

  const explained = endpoints.filter((e) => e.template !== null).length;
  return {
    endpoints,
    sourceOnly,
    files,
    summary: {
      observedEndpoints: endpoints.length,
      explained,
      unexplained: endpoints.length - explained,
      sourceOnly: sourceOnly.length,
      filesSeenAtRuntime: Object.keys(files).length,
      sourceFiles: graph.files.length,
    },
  };
}
