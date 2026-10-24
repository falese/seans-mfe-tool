/**
 * The source graph (ADR-109 §3, #414): per-file facts joined across files.
 *
 * - Imports are resolved to files, and imported names to the file and local
 *   name that define them, through re-exports and barrels.
 * - HTTP URLs are followed through wrapper functions until they are concrete:
 *   `getBerths = () => hm('/berths')` with `hm(path)` calling
 *   `http.get(BASE.harbormaster + path)` is `GET /api/harbormaster/berths`.
 * - Routes are resolved to the files of their element components.
 * - Store reads are resolved to endpoints: a consumer of `useAppState()` that
 *   reads `dockings` depends on whatever call loaded `dockings` in the store.
 * - Every file is assigned to the screens (routes) that reach it through the
 *   import graph, to the app shell, or flagged shared or unreached.
 *
 * Everything here is pure over `FileFacts`.
 */

import * as path from 'path';
import type { FileFacts, FunctionFact } from './parse';

export interface Endpoint {
  method: string;
  /** URL template; `{name}` is a parameter, `{?}` an unresolved part. */
  url: string;
}

export interface ScreenRoute {
  path: string;
  /** Component files rendered for this path, with the landmark each renders into. */
  elements: Array<{ component: string; file: string | null; container: string | null }>;
}

export type Assignment =
  | { category: 'screen'; screens: [string] }
  | { category: 'shared'; screens: string[]; shell: boolean }
  | { category: 'shell'; screens: [] }
  | { category: 'unreached'; screens: [] };

export interface FileNode {
  file: string;
  components: string[];
  /** Resolved local imports. */
  imports: string[];
  /** Packages imported. */
  packages: string[];
  /** Endpoints this file's code reaches through calls into other files, or calls itself. */
  endpoints: Endpoint[];
  /** True when the file holds the HTTP call sites (an API client). */
  apiClient: boolean;
  /** Store fields read through a hook, and the endpoints that load them. */
  storeReads: Array<{ hook: string; store: string; field: string; endpoints: Endpoint[] }>;
  /** Landmarks the file renders (`main`, `nav`, `aside`, `header`, `footer`). */
  landmarks: string[];
  /** Components the file renders, resolved to their files; `repeated` when rendered per item of a list. */
  renders: Array<{ component: string; file: string | null; repeated: boolean }>;
  assignment: Assignment;
}

export interface SourceGraph {
  files: FileNode[];
  routes: ScreenRoute[];
  entries: string[];
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Resolve an import specifier from `from` to a file in `files`, or null for a package. */
export function resolveModule(from: string, spec: string, files: Set<string>): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  const candidates = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => `${base}/index${e}`)];
  return candidates.find((c) => files.has(c)) ?? null;
}

function packageOf(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export interface SymbolRef {
  file: string;
  /** Local name in `file`. */
  name: string;
}

function key(ref: SymbolRef): string {
  return `${ref.file}#${ref.name}`;
}

export function buildSourceGraph(all: FileFacts[]): SourceGraph {
  const byFile = new Map(all.map((f) => [f.file, f]));
  const fileSet = new Set(byFile.keys());

  // ---- symbols ----------------------------------------------------------------
  const resolveExport = (file: string, name: string, seen = new Set<string>()): SymbolRef | null => {
    const tag = `${file}:${name}`;
    if (seen.has(tag)) return null;
    seen.add(tag);
    const facts = byFile.get(file);
    if (!facts) return null;
    const local = facts.exports[name];
    if (local !== undefined) {
      // `export default CargoManifest` where CargoManifest is imported: follow it.
      return resolveLocal(file, local, seen) ?? { file, name: local };
    }
    for (const re of facts.reexports) {
      const target = resolveModule(file, re.spec, fileSet);
      if (!target) continue;
      if (re.names === '*') {
        if (name === 'default') continue;
        const hit = resolveExport(target, name, seen);
        if (hit) return hit;
      } else {
        const match = re.names.find((n) => n.exported === name);
        if (match) return resolveExport(target, match.imported, seen);
      }
    }
    return null;
  };

  const resolveLocal = (file: string, local: string, seen = new Set<string>()): SymbolRef | null => {
    const facts = byFile.get(file);
    if (!facts) return null;
    for (const imp of facts.imports) {
      const binding = imp.names.find((n) => n.local === local);
      if (!binding) continue;
      const target = resolveModule(file, imp.spec, fileSet);
      if (!target || binding.imported === '*') return null;
      return resolveExport(target, binding.imported, seen);
    }
    return null;
  };

  /** What a name used in `file` refers to: a local function, or an import. */
  const resolveName = (file: string, name: string): SymbolRef | null => {
    const facts = byFile.get(file);
    if (facts?.functions.some((f) => f.name === name)) return { file, name };
    return resolveLocal(file, name);
  };

  // ---- endpoints: follow URLs through wrapper functions ------------------------
  const fns = new Map<string, FunctionFact>();
  for (const f of all) for (const fn of f.functions) fns.set(key({ file: f.file, name: fn.name }), fn);

  const endpointsOf = new Map<string, Endpoint[]>();
  for (const [k, fn] of fns) endpointsOf.set(k, fn.http.map((h) => ({ method: h.method, url: h.url })));

  const substitute = (url: string, params: string[], args: Array<string | null>): string =>
    url.replace(/\{([A-Za-z_$][\w$]*)\}/g, (m, p: string) => {
      const i = params.indexOf(p);
      if (i < 0) return m;
      return args[i] ?? '{?}';
    });

  for (let round = 0; round < 10; round += 1) {
    let changed = false;
    for (const [k, fn] of fns) {
      const file = k.slice(0, k.lastIndexOf('#'));
      const mine = endpointsOf.get(k) as Endpoint[];
      for (const call of fn.calls) {
        const target = resolveName(file, call.callee);
        if (!target) continue;
        const targetFn = fns.get(key(target));
        for (const ep of endpointsOf.get(key(target)) ?? []) {
          const url = targetFn ? substitute(ep.url, targetFn.params, call.args) : ep.url;
          if (!mine.some((m) => m.method === ep.method && m.url === url)) {
            mine.push({ method: ep.method, url });
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }

  /** An endpoint whose URL still carries one of its own function's parameters is a template, not a call. */
  const concrete = (fn: FunctionFact, ep: Endpoint) =>
    !fn.params.some((p) => ep.url.includes(`{${p}}`));

  // ---- store: field → endpoints, hook → store file -----------------------------
  const storeFieldEndpoints = new Map<string, Map<string, Endpoint[]>>();
  for (const f of all) {
    if (f.storeLoads.length === 0) continue;
    const fields = new Map<string, Endpoint[]>();
    for (const load of f.storeLoads) {
      const target = resolveName(f.file, load.callee);
      fields.set(load.field, target ? (endpointsOf.get(key(target)) ?? []) : []);
    }
    storeFieldEndpoints.set(f.file, fields);
  }

  // ---- import graph -------------------------------------------------------------
  const importsOf = new Map<string, string[]>();
  const packagesOf = new Map<string, string[]>();
  for (const f of all) {
    const local = new Set<string>();
    const pkgs = new Set<string>();
    for (const spec of [...f.imports.map((i) => i.spec), ...f.reexports.map((r) => r.spec)]) {
      const target = resolveModule(f.file, spec, fileSet);
      if (target) local.add(target);
      else if (!spec.startsWith('.')) pkgs.add(packageOf(spec));
    }
    importsOf.set(f.file, [...local].sort());
    packagesOf.set(f.file, [...pkgs].sort());
  }
  // Entries mount the app. A file nothing imports that mounts nothing is dead code, not an entry.
  const entries = all.filter((f) => f.bootstraps).map((f) => f.file).sort();

  // ---- routes ---------------------------------------------------------------------
  const routeMap = new Map<string, ScreenRoute>();
  for (const f of all) {
    for (const r of f.routes) {
      if (r.path === null) continue;
      const route = routeMap.get(r.path) ?? { path: r.path, elements: [] };
      routeMap.set(r.path, route);
      if (!r.element) continue;
      const target = resolveName(f.file, r.element);
      route.elements.push({ component: target?.name ?? r.element, file: target?.file ?? null, container: r.container });
    }
  }
  const routes = [...routeMap.values()].sort((a, b) => a.path.localeCompare(b.path));

  // ---- assignment: which roots reach each file -----------------------------------
  const roots = new Map<string, Set<string>>(); // root label → files
  const rootFiles = new Set<string>();
  for (const r of routes) for (const e of r.elements) if (e.file) rootFiles.add(e.file);
  const reach = (start: string[], stopAt: Set<string>): Set<string> => {
    const seen = new Set<string>();
    const stack = [...start];
    while (stack.length > 0) {
      const f = stack.pop() as string;
      if (seen.has(f)) continue;
      seen.add(f);
      for (const next of importsOf.get(f) ?? []) if (!stopAt.has(next)) stack.push(next);
    }
    return seen;
  };
  for (const r of routes) {
    const files = r.elements.map((e) => e.file).filter((f): f is string => !!f);
    if (files.length > 0) roots.set(r.path, reach(files, new Set()));
  }
  const shell = reach(entries, rootFiles);

  const ownersOf = (file: string): { screens: string[]; shell: boolean } => ({
    screens: [...roots].filter(([, files]) => files.has(file)).map(([p]) => p).sort(),
    shell: shell.has(file),
  });

  const assign = (file: string): Assignment => {
    const { screens, shell: inShell } = ownersOf(file);
    if (screens.length === 1 && !inShell) return { category: 'screen', screens: [screens[0]] };
    if (screens.length === 0 && inShell) {
      // A barrel the shell imports that only leads into one screen belongs to that screen.
      const leads = new Set((importsOf.get(file) ?? []).flatMap((t) => ownersOf(t).screens));
      const onlyScreen = (importsOf.get(file) ?? []).every((t) => {
        const o = ownersOf(t);
        return o.screens.length === 1 && !(o.shell && !rootFiles.has(t));
      });
      if (leads.size === 1 && onlyScreen && (importsOf.get(file) ?? []).length > 0) {
        return { category: 'screen', screens: [[...leads][0]] };
      }
      return { category: 'shell', screens: [] };
    }
    if (screens.length === 0) return { category: 'unreached', screens: [] };
    return { category: 'shared', screens, shell: inShell };
  };

  // ---- per-file nodes ---------------------------------------------------------------
  const files: FileNode[] = all
    .map((f): FileNode => {
      const endpoints: Endpoint[] = [];
      for (const fn of f.functions) {
        for (const ep of endpointsOf.get(key({ file: f.file, name: fn.name })) ?? []) {
          if (concrete(fn, ep) && !endpoints.some((e) => e.method === ep.method && e.url === ep.url)) endpoints.push(ep);
        }
      }
      const storeReads: FileNode['storeReads'] = [];
      for (const read of f.hookReads) {
        const hook = resolveName(f.file, read.hook);
        const fields = hook ? storeFieldEndpoints.get(hook.file) : undefined;
        if (!hook || !fields) continue;
        for (const field of read.fields) {
          if (fields.has(field)) storeReads.push({ hook: read.hook, store: hook.file, field, endpoints: fields.get(field) ?? [] });
        }
      }
      return {
        file: f.file,
        components: f.components,
        imports: importsOf.get(f.file) ?? [],
        packages: packagesOf.get(f.file) ?? [],
        endpoints: endpoints.sort((a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method)),
        apiClient: f.functions.some((fn) => fn.http.length > 0),
        storeReads,
        landmarks: f.landmarks,
        renders: f.renders.map((r) => {
          const target = resolveName(f.file, r.component);
          return { component: target?.name ?? r.component, file: target?.file ?? null, repeated: r.repeated };
        }),
        assignment: assign(f.file),
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file));

  return { files, routes, entries };
}
