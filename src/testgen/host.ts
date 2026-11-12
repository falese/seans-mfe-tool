/**
 * The capability host (ADR-129 §13): one MFE's capabilities, each mounted by the
 * platform, on a page SMT serves, so it can be crawled and recorded in any framework.
 *
 * A standalone page is each framework's own: React's generated one tabs its capabilities,
 * Angular's renders none of them. The platform's own way to put a capability on a page is
 * the shell's adaptor (`moduleFederationAdaptor`, ADR-100), through the remote's sealed
 * mount handle, which brings its own framework. This page uses exactly that: a tab per
 * capability (host chrome), and the selected one mounted into a slot carrying the boundary
 * stamp a shell's slot carries (#408). Region capture reads the stamp, not a framework's
 * internals, so a recording made here is the same for React, Angular, or anything else
 * the shell can compose.
 */

import { createServer, type Server } from 'http';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ValidationError } from '@seans-mfe/contracts';
import { deriveRegistration, type DSLManifest } from '@seans-mfe/dsl';
import { HOST_PATH } from '../decompose/bundle';

/** Where the host is served by default: recordings name it, so a replay finds it there. */
export const HOST_PORT = 5180;

export interface HostTarget {
  mfe: string;
  capabilities: string[];
  remoteEntryUrl: string;
  scope: string;
  module: string;
}

/**
 * Where the platform finds an MFE's capabilities: its registration's container
 * (`deriveRegistration`, as the control plane compiles it) and its domain capabilities.
 * `remote` is the origin it is served from, when not the manifest's own `remoteEntry`.
 */
export function hostTarget(manifest: DSLManifest, remote?: string): HostTarget {
  const registration = deriveRegistration(manifest);
  const capabilities = (manifest.capabilities ?? [])
    .flatMap((entry) => Object.entries(entry))
    .filter(([, v]) => !v || v.type === undefined || v.type === 'domain')
    .map(([name]) => name);
  const remoteEntryUrl = remote ? new URL('remoteEntry.js', remote.replace(/\/*$/, '/')).toString() : registration.remoteEntryUrl;
  return {
    mfe: manifest.name,
    capabilities,
    remoteEntryUrl: remoteEntryUrl ?? '',
    scope: registration.moduleFederation?.scope ?? manifest.name.replace(/-/g, '_'),
    module: registration.moduleFederation?.module ?? './App',
  };
}

/**
 * Runs in the page. Loads the runtime's compiled adaptor through a CommonJS loader (the
 * runtime is CommonJS, `@seans-mfe/contracts` its one bare import) from under `HOST_PATH`,
 * which capture never records (the host is not the MFE), then mounts the
 * capability the hash names. `window.__SMT_HOST_ADAPTOR__` stands in for the adaptor in a
 * test.
 */
export const HOST_SCRIPT = `(function () {
  var C = window.__SMT_HOST__;
  var host = document.getElementById('host');
  var loaded = null;
  // Loaded once for the page's life, as a shell loads it: the runtime keeps the share scope
  // every remote is initialised with, and a container refuses a second one.
  function adaptor() {
    if (window.__SMT_HOST_ADAPTOR__) return window.__SMT_HOST_ADAPTOR__;
    if (loaded) return loaded;
    var cache = {};
    var missing = [];
    function get(url) { var x = new XMLHttpRequest(); x.open('GET', url, false); x.send(); return x.status === 200 ? x.responseText : null; }
    function load(url) {
      if (cache[url]) return cache[url].exports;
      var source = get(url);
      if (source === null) {
        missing.push(url);
        return {};
      }
      var module = { exports: {} };
      cache[url] = module;
      var dir = url.slice(0, url.lastIndexOf('/') + 1);
      function req(spec) {
        if (spec === '@seans-mfe/contracts') return load(location.origin + C.base + '/contracts/index.js');
        var base = new URL(spec, dir).href.replace(/\\.js$/, '');
        return get(base + '.js') !== null ? load(base + '.js') : load(base + '/index.js');
      }
      new Function('module', 'exports', 'require', source + '\\n//# sourceURL=' + url)(module, module.exports, req);
      return module.exports;
    }
    var a = load(location.origin + C.base + '/runtime/layout-adaptors.js').moduleFederationAdaptor;
    // Reported in the slot, as any failure to mount is: the page has no typed errors to throw.
    if (missing.length > 0 || !a) return { mount: function () { return Promise.reject('the runtime is not served: ' + missing.join(', ')); } };
    loaded = a;
    return loaded;
  }
  // The daemon channel a shell hands every slot (ADR-057): accepted, never sent anywhere.
  var channel = { connected: true, mutation: function () { return Promise.resolve(true); } };
  var current = null;
  var n = 0;
  // #/<Capability>?<prop>=<value>&…: the capability, and the props a composition would pass it.
  function selected() {
    var m = /^#\\/([^?]+)(?:\\?(.*))?$/.exec(location.hash);
    var name = m ? decodeURIComponent(m[1]) : '';
    var props = {};
    if (m && m[2]) new URLSearchParams(m[2]).forEach(function (v, k) { props[k] = v; });
    return { cap: C.capabilities.indexOf(name) >= 0 ? name : C.capabilities[0], props: props, key: location.hash };
  }
  async function show() {
    var sel = selected();
    var cap = sel.cap;
    // Selecting what is already shown leaves it as it is: a click on its own tab is not a reload.
    if (current && current.cap === cap && JSON.stringify(current.props) === JSON.stringify(sel.props)) return;
    var tabs = document.querySelectorAll('[role=tab]');
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute('aria-selected', String(tabs[i].getAttribute('data-capability') === cap));
    if (current) {
      try { if (current.unmount) await current.unmount(); } catch (e) { /* the next mount is what matters */ }
      current.el.remove();
    }
    var el = document.createElement('div');
    el.setAttribute('data-smt-mfe', C.mfe);
    el.setAttribute('data-smt-capability', cap);
    el.setAttribute('data-slot-state', 'loading');
    host.appendChild(el);
    current = { el: el, cap: cap, props: sel.props };
    n += 1;
    try {
      var unmount = await adaptor().mount(
        { id: 'host-' + n, capability: cap, output: { remoteEntryUrl: C.remoteEntryUrl, scope: C.scope, module: C.module, component: cap, props: sel.props } },
        el,
        { channel: channel }
      );
      current.unmount = unmount;
      el.setAttribute('data-slot-state', 'ready');
    } catch (e) {
      el.setAttribute('data-slot-state', 'error');
      el.textContent = 'Could not mount ' + cap + ': ' + (e && e.message ? e.message : String(e));
      console.error('smt host: ' + el.textContent);
    }
  }
  window.addEventListener('hashchange', show);
  window.__SMT_HOST_READY__ = show();
})();`;

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function hostPage(t: HostTarget): string {
  const tabs = t.capabilities.map((c) => `<a role="tab" data-capability="${escape(c)}" href="#/${encodeURIComponent(c)}">${escape(c)}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(t.mfe)} — capability host</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fff;color:#111}nav{display:flex;gap:4px;padding:8px 16px;border-bottom:1px solid #ddd}nav a{padding:6px 10px;color:#333;text-decoration:none}nav a[aria-selected=true]{border-bottom:2px solid #333}main{padding:16px}</style>
</head><body>
<nav role="tablist" aria-label="${escape(t.mfe)} capabilities">${tabs}</nav>
<main id="host"></main>
<script>window.__SMT_HOST__ = ${JSON.stringify({ ...t, base: HOST_PATH }).replace(/</g, '\\u003c')};</script>
<script>${HOST_SCRIPT}</script>
</body></html>
`;
}

const TYPES: Record<string, string> = { '.js': 'text/javascript', '.map': 'application/json', '.json': 'application/json' };

/** The runtime the host mounts through, and the one package it requires. */
export function hostRoots(repoRoot = path.resolve(__dirname, '..', '..')): Record<string, string> {
  return {
    [`${HOST_PATH}/runtime/`]: path.join(repoRoot, 'dist', 'runtime'),
    [`${HOST_PATH}/contracts/`]: path.dirname(require.resolve('@seans-mfe/contracts')),
  };
}

export async function serveHost(t: HostTarget, opts: { port?: number; roots?: Record<string, string> } = {}): Promise<{ url: string; server: Server; close: () => Promise<void> }> {
  const roots = opts.roots ?? hostRoots();
  const page = hostPage(t);
  const server = createServer((req, res) => {
    void (async () => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page);
        return;
      }
      const prefix = Object.keys(roots).find((p) => url.startsWith(p));
      const file = prefix ? path.join(roots[prefix], url.slice(prefix.length)) : null;
      if (!prefix || !file || !file.startsWith(roots[prefix] + path.sep)) {
        res.writeHead(404).end();
        return;
      }
      const stat = await fs.stat(file).catch(() => null);
      if (!stat?.isFile()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await fs.readFile(file));
    })();
  });
  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : opts.port;
  return {
    // `localhost`, not the address: a BFF's CORS allows the origins a shell is served from.
    url: `http://localhost:${port}/`,
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** An MFE directory's manifest, as the host needs it. */
export async function readHostManifest(mfeDir: string): Promise<DSLManifest> {
  const file = path.join(mfeDir, 'mfe-manifest.yaml');
  if (!(await fs.pathExists(file))) throw new ValidationError(`${mfeDir} has no mfe-manifest.yaml`, 'mfe', 'manifest');
  return yaml.load(await fs.readFile(file, 'utf8')) as DSLManifest;
}

/**
 * Serve an MFE's capability host for as long as `fn` runs. The host mounts through the
 * compiled runtime, so a CLI that has not been built cannot serve it.
 */
export async function withHost<T>(mfeDir: string, o: { remote?: string; port?: number }, fn: (url: string, target: HostTarget) => Promise<T>): Promise<T> {
  const roots = hostRoots();
  const adaptors = path.join(roots[`${HOST_PATH}/runtime/`], 'layout-adaptors.js');
  if (!(await fs.pathExists(adaptors))) throw new ValidationError(`the capability host mounts through ${adaptors}, which is not built: run npm run build`, 'runtime', 'built');
  const target = hostTarget(await readHostManifest(mfeDir), o.remote);
  if (!target.remoteEntryUrl) throw new ValidationError(`${target.mfe} declares no remoteEntry: pass --remote <the origin it is served from>`, 'remote', 'required');
  if (target.capabilities.length === 0) throw new ValidationError(`${target.mfe} declares no domain capability to host`, 'capabilities', 'domain');
  const host = await serveHost(target, { port: o.port, roots });
  try {
    return await fn(host.url, target);
  } finally {
    await host.close();
  }
}
