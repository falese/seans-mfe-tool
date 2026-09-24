#!/usr/bin/env node
/**
 * Mount every generated Rust/WASM remote through the SHELL'S OWN adaptor, in a
 * real browser (ADR-100).
 *
 * The claim ADR-100 makes is that a WebAssembly build needs no shell, runtime
 * or control-plane change: it is a Module Federation remote like any other.
 * The only way to prove that is to run the code the shell runs. So this does
 * not re-implement the loading steps — it serves the compiled
 * `dist/runtime/layout-adaptors.js` and `@seans-mfe/contracts` into the page
 * through a tiny CommonJS loader, and calls `moduleFederationAdaptor.mount()`
 * with the same experience shape the control plane publishes.
 *
 * Per crate it checks, for every capability the Rust target implements:
 *   - the adaptor mounts it and the capability's renderer drew into the slot
 *   - two capabilities mount side by side (the adaptor's per-scope queue)
 *   - the returned unmount empties the slot
 *   - an unknown capability is rejected rather than rendering nothing
 * and then all ten platform capabilities through the remote's `mfe` object
 * (ADR-101), in the browser:
 *   - the daemon channel the ADAPTOR handed over (ADR-057) receives the
 *     STATE_UPDATE envelope from updateControlPlaneState
 *   - query reaches a stub BFF through the generated fetch transport
 *   - emit reaches an attached telemetry function
 *   - health, describe, schema, refresh, authorizeAccess answer in the
 *     contract's shapes
 *
 * Prerequisites: `npm run build` (dist/runtime), `bash rust/web/build.sh` for
 * each crate (www/pkg), and a Chromium Playwright can launch. Without them it
 * SKIPS with a notice; `--require` makes that a failure, which CI uses.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRE = process.argv.includes('--require');

function skip(reason) {
  if (REQUIRE) {
    console.error(`check:rust-wasm-mount: ${reason}, and --require was passed.`);
    process.exit(1);
  }
  console.log(`check:rust-wasm-mount: SKIPPED — ${reason}.`);
  process.exit(0);
}

/** Every examples/** MFE whose manifest builds the Rust target for the browser. */
function findCrates() {
  const yaml = require('js-yaml');
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      const manifestPath = path.join(full, 'mfe-manifest.yaml');
      if (existsSync(manifestPath)) {
        const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
        const rust = manifest?.targets?.rust;
        if (rust?.wasm === true) {
          const domain = (manifest.capabilities ?? [])
            .flatMap((c) => Object.entries(c))
            .filter(([, cfg]) => cfg?.type === 'domain')
            .map(([name]) => name);
          const capabilities = rust.capabilities ? rust.capabilities.filter((c) => domain.includes(c)) : domain;
          const crateName = rust.crateName || manifest.name.replace(/[^A-Za-z0-9_-]+/g, '-');
          const lib = (/^[0-9]/.test(crateName) ? `mfe-${crateName}` : crateName).replace(/-/g, '_');
          out.push({ dir: full, www: path.join(full, 'rust', 'web', 'www'), scope: `${lib}_wasm`, capabilities });
        }
        continue;
      }
      walk(full);
    }
  };
  walk(path.join(REPO, 'examples'));
  return out;
}

const TYPES = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.json': 'application/json' };

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>wasm mount</title></head>
<body><div id="react-neighbour">a React remote would sit here</div></body></html>`;

function serve(crates) {
  const roots = {
    '/runtime/': path.join(REPO, 'dist', 'runtime'),
    '/contracts/': path.join(REPO, 'packages', 'contracts', 'dist'),
  };
  crates.forEach((c, i) => {
    roots[`/remote/${i}/`] = c.www;
  });
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    // A stub BFF for the query capability: echoes the document it was sent,
    // so the check can tell the request really went through fetch.
    if (url === '/graphql' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let document = null;
      try {
        document = JSON.parse(body).query ?? null;
      } catch {
        document = null;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({ data: { echoed: document, authorization: req.headers.authorization ?? null } }),
      );
      return;
    }
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(FIXTURE);
      return;
    }
    const prefix = Object.keys(roots).find((p) => url.startsWith(p));
    if (!prefix) {
      res.writeHead(404).end();
      return;
    }
    const file = path.join(roots[prefix], url.slice(prefix.length));
    if (!file.startsWith(roots[prefix])) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw new Error('not a file');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * Runs IN THE PAGE: load the real adaptor, mount through it, report.
 * Serialized by Playwright, so it may use only browser globals.
 */
/* global document, location, XMLHttpRequest */
async function inPage({ remoteEntryUrl, scope, capabilities }) {
  const cache = {};
  const get = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    return xhr.status === 200 ? xhr.responseText : null;
  };
  const load = (url) => {
    if (cache[url]) return cache[url].exports;
    const source = get(url);
    if (source === null) throw new Error(`module not found: ${url}`);
    const module = { exports: {} };
    cache[url] = module;
    const dir = url.slice(0, url.lastIndexOf('/') + 1);
    const req = (spec) => {
      if (spec === '@seans-mfe/contracts') return load(new URL('/contracts/index.js', location.href).href);
      const base = new URL(spec, dir).href.replace(/\.js$/, '');
      return get(`${base}.js`) !== null ? load(`${base}.js`) : load(`${base}/index.js`);
    };
    new Function('module', 'exports', 'require', `${source}\n//# sourceURL=${url}`)(module, module.exports, req);
    return module.exports;
  };

  const { moduleFederationAdaptor } = load(new URL('/runtime/layout-adaptors.js', location.href).href);
  const experience = (capability, id) => ({
    id,
    capability,
    output: { remoteEntryUrl, scope, module: './App', component: capability, props: { probe: id } },
  });
  const slot = () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  };

  // The daemon channel the shell hands every slot (ADR-057). The ADAPTOR
  // passes it to the remote's mfe.attachControlPlane — not this script.
  const sent = [];
  const channel = {
    connected: true,
    mutation: (query, variables, timeout) => {
      sent.push({ query, variables, timeout });
      return Promise.resolve(true);
    },
  };

  const report = { mounted: [], unmountedEmpty: true, sideBySide: 0, unknownRejected: false };
  const unmounts = [];
  for (const [i, capability] of capabilities.entries()) {
    const el = slot();
    const unmount = await moduleFederationAdaptor.mount(experience(capability, `e${i}`), el, { channel });
    const card = el.querySelector(`[data-capability="${capability}"][data-rendered-by="rust-wasm"]`);
    // The markers, not the content: a capability's renderer is developer-owned
    // (Meridian's draws live payroll), so only the data-capability /
    // data-rendered-by stamp the seeded renderer puts on its root is contract.
    report.mounted.push({ capability, drawn: !!card });
    unmounts.push({ el, unmount });
  }
  report.sideBySide = document.querySelectorAll('[data-rendered-by="rust-wasm"]').length;
  for (const { el, unmount } of unmounts) {
    await unmount();
    if (el.querySelector('[data-rendered-by]')) report.unmountedEmpty = false;
  }
  try {
    await moduleFederationAdaptor.mount(experience('NotACapability', 'bad'), slot(), {});
  } catch (error) {
    report.unknownRejected = /NotACapability/.test(String(error?.message ?? error));
  }
  report.neighbourIntact = document.getElementById('react-neighbour')?.textContent === 'a React remote would sit here';

  // All ten capabilities through the remote's mfe object (ADR-101).
  const exposed = (await globalThis[scope].get('./App'))();
  const mfe = exposed.mfe;
  const events = [];
  mfe.attachTelemetry((event) => events.push(event));
  const cap = capabilities[0];
  const run = async (name, context) => {
    try {
      return { ok: true, value: await mfe[name](context ?? {}) };
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error) };
    }
  };
  report.capabilities = {
    load: await run('load'),
    render: await run('render', { capabilityId: cap }),
    refresh: await run('refresh'),
    authorizeAccess: await run('authorizeAccess'),
    health: await run('health'),
    describe: await run('describe'),
    schema: await run('schema'),
    query: await run('query', {
      jwt: 'tok',
      inputs: { document: 'query { probe }', bffUrl: new URL('/graphql', location.href).href },
    }),
    emit: await run('emit', { inputs: { event: { name: 'clicked', capability: 'render', phase: 'main', status: 'success' } } }),
    updateControlPlaneState: await run('updateControlPlaneState', {
      inputs: { stateKey: 'crew.selected', stateData: { id: 42 }, correlationId: 'probe-1' },
    }),
  };
  report.sent = sent.map((s) => ({ query: s.query, envelope: JSON.parse(s.variables.m) }));
  report.events = events.map((e) => e.name);
  return report;
}

/** The ten capabilities, checked against the contract's result shapes. */
function tenCapabilityChecks(report) {
  const c = report.capabilities ?? {};
  const v = (name) => (c[name]?.ok ? c[name].value : undefined);
  const envelope = report.sent?.[0]?.envelope;
  return [
    ['load → status loaded', v('load')?.status === 'loaded'],
    ['render → status rendered', v('render')?.status === 'rendered'],
    ['refresh answers', c.refresh?.ok === true],
    ['authorizeAccess → true', v('authorizeAccess') === true],
    ['health → status + checks', typeof v('health')?.status === 'string' && Array.isArray(v('health')?.checks)],
    ['describe → type + manifest', typeof v('describe')?.type === 'string' && typeof v('describe')?.manifest === 'object'],
    ['schema → manifest JSON', v('schema')?.format === 'json' && (() => { try { return !!JSON.parse(v('schema').schema).name; } catch { return false; } })()],
    ['query → reached the BFF through fetch, with the bearer token', v('query')?.data?.echoed === 'query { probe }' && v('query')?.data?.authorization === 'Bearer tok'],
    ['emit → delivered to attached telemetry', v('emit')?.emitted === true && (report.events ?? []).includes('clicked')],
    ['updateControlPlaneState → acknowledged over the adaptor-attached channel', v('updateControlPlaneState')?.acknowledged === true && v('updateControlPlaneState')?.correlationId === 'probe-1'],
    ['  … sending the STATE_UPDATE envelope', envelope?.payload?.actionType === 'STATE_UPDATE' && envelope?.payload?.stateKey === 'crew.selected' && envelope?.metadata?.correlationId === 'probe-1'],
  ].map(([name, ok]) => {
    if (!ok) {
      const key = name.split(' ')[0];
      if (c[key] && !c[key].ok) return [`${name} (${c[key].error})`, false];
    }
    return [name, ok];
  });
}

async function main() {
  if (!existsSync(path.join(REPO, 'dist', 'runtime', 'layout-adaptors.js'))) {
    skip('dist/runtime is not built (run npm run build)');
  }
  const crates = findCrates();
  if (crates.length === 0) {
    // A repo that ships the WASM build and then stops generating one should
    // fail here rather than pass vacuously.
    console.error('check:rust-wasm-mount: no examples/** MFE declares targets.rust.wasm.');
    process.exit(1);
  }
  const unbuilt = crates.filter((c) => !existsSync(path.join(c.www, 'pkg', 'mfe_bg.wasm')));
  if (unbuilt.length > 0) {
    skip(`not built: ${unbuilt.map((c) => path.relative(REPO, c.www)).join(', ')} (run rust/web/build.sh)`);
  }

  let chromium;
  try {
    ({ chromium } = require('@playwright/test'));
  } catch {
    skip('@playwright/test is not installed');
  }
  let browser;
  try {
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  } catch (error) {
    skip(`no launchable Chromium (${String(error.message).split('\n')[0]})`);
  }

  const server = await serve(crates);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let failed = false;
  try {
    for (const [i, crate] of crates.entries()) {
      const rel = path.relative(REPO, crate.dir);
      console.log(`\n=== ${rel}  (scope ${crate.scope}; ${crate.capabilities.join(', ')})`);
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${origin}/`);
      const report = await page.evaluate(inPage, {
        remoteEntryUrl: `${origin}/remote/${i}/remoteEntry.js`,
        scope: crate.scope,
        capabilities: crate.capabilities,
      });
      const checks = [
        ...report.mounted.map((m) => [`mounted ${m.capability} through moduleFederationAdaptor`, m.drawn]),
        [`${crate.capabilities.length} capabilities side by side`, report.sideBySide === crate.capabilities.length],
        ['unmount empties the slot', report.unmountedEmpty],
        ['unknown capability is rejected', report.unknownRejected],
        ['neighbouring content untouched', report.neighbourIntact],
        ...tenCapabilityChecks(report),
        ['no uncaught page errors', errors.length === 0],
      ];
      for (const [name, ok] of checks) {
        console.log(`  ${ok ? '✓' : '✗'} ${name}`);
        if (!ok) failed = true;
      }
      if (errors.length) console.log(`  page errors: ${errors.join(' | ')}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) {
    console.error('\ncheck:rust-wasm-mount: FAILURES above.');
    process.exit(1);
  }
  console.log(`\ncheck:rust-wasm-mount: ${crates.length} WASM remote(s) mounted through the shell's adaptor.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
