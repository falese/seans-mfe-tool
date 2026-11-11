/**
 * The legacy wrapper (ADR-111): the monolith as one generated SMT MFE.
 *
 * The monolith's own build gains a Module Federation remote entry exposing a
 * `mount(element)` function. `legacy-<app>` is an ordinary SMT MFE whose single
 * domain capability loads that entry and mounts the monolith into its element.
 * The shell places it like any other capability, through the
 * `moduleFederation` adaptor and the LayoutManager: no legacy branch in the
 * runtime (ADR-111 §2).
 *
 * The monolith is composed as an island with its own React (ADR-060's value
 * injection, not shared singletons): a monolith pins whatever React it was
 * written against, and reconciling that with the fleet's is a port-time
 * decision, not a precondition of the first composed run.
 */

import type { ControlPlaneDocument } from '@seans-mfe/dsl';
import type { Decomposition } from '@seans-mfe/decompose';

const pascal = (s: string): string =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

const kebab = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const legacyMfeName = (doc: Decomposition): string => `legacy-${kebab(doc.app.name)}`;
export const legacyCapabilityName = (doc: Decomposition): string => `Legacy${pascal(doc.app.name)}`;
/** The monolith's federation container name: a JS identifier. */
export const remoteScope = (doc: Decomposition): string => kebab(doc.app.name).replace(/-/g, '_');

export function legacyManifest(doc: Decomposition, opts: { port: number }): Record<string, unknown> {
  const cap = legacyCapabilityName(doc);
  return {
    name: legacyMfeName(doc),
    version: '0.1.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    description: `${doc.app.name}, whole, as one capability — the strangler's starting point (ADR-111). Removed once nothing places it.`,
    owner: doc.app.name,
    hosts: [{ id: doc.app.namespace }],
    endpoint: `http://localhost:${opts.port}`,
    remoteEntry: `http://localhost:${opts.port}/remoteEntry.js`,
    discovery: `http://localhost:${opts.port}/.well-known/mfe-manifest.yaml`,
    capabilities: [
      { [cap]: { type: 'domain', description: `Mounts ${doc.app.name}'s root through its Module Federation remote entry` } },
      {
        Load: {
          type: 'platform',
          lifecycle: { error: [{ onLoadError: { handler: 'onLoadError', contained: true, description: 'Log load failure' } }] },
        },
      },
      {
        Render: {
          type: 'platform',
          lifecycle: { error: [{ onRenderError: { handler: 'onRenderError', contained: true, description: 'Log render failure' } }] },
        },
      },
    ],
  };
}

/**
 * The composition the strangler starts from (ADR-111 §3): every state key the
 * proposal routes, and the root, show the legacy capability in the shell's
 * root. Every proposed MFE is listed, so `compose:validate` already checks the
 * whole fleet, but nothing places them yet; each strangler step moves one
 * placement (#419).
 */
export function legacyComposition(doc: Decomposition): ControlPlaneDocument {
  const root = `${doc.app.namespace}.root`;
  const keys = [root, ...doc.routes.map((r) => r.stateKey).filter((k) => k !== root)];
  const capability = legacyCapabilityName(doc);
  return {
    project: doc.app.name,
    namespace: doc.app.namespace,
    mfes: [...doc.domains.map((d) => d.mfe), legacyMfeName(doc)],
    routes: [...new Set(keys)].map((when) => ({ when, place: [{ capability, into: 'root' }] })),
  } as ControlPlaneDocument;
}

/**
 * The capability's feature component. Developer-owned (ADR-087): written once
 * by scaffold, never regenerated. It draws nothing of its own — the parity
 * gate allows a wrapper only when it shows no text (ADR-113).
 */
export function legacyFeatureSource(doc: Decomposition, opts: { remoteEntry: string }): string {
  const cap = legacyCapabilityName(doc);
  return `/**
 * ${cap} — ${doc.app.name}, whole, mounted from its own build (ADR-111).
 *
 * Loads the monolith's Module Federation remote entry and calls the
 * \`mount(element)\` it exposes. The monolith renders with its own React and
 * router, as an island (ADR-060); this component draws nothing itself, so the
 * parity gate sees the monolith's regions and nothing else (ADR-113).
 *
 * Written by decompose:scaffold. Developer-owned: regeneration never touches it.
 * Point REMOTE_ENTRY at wherever the monolith is served.
 */
import React, { useEffect, useRef } from 'react';

const REMOTE_ENTRY = '${opts.remoteEntry}';
const SCOPE = '${remoteScope(doc)}';
const MODULE = './mount';

type Unmount = () => void;
interface Container {
  init(shareScope: Record<string, unknown>): Promise<void> | void;
  get(module: string): Promise<() => { mount(element: HTMLElement): Unmount }>;
}

let loading: Promise<(element: HTMLElement) => Unmount> | undefined;

function loadMount(): Promise<(element: HTMLElement) => Unmount> {
  loading ??= new Promise<Container>((resolve, reject) => {
    const existing = (window as unknown as Record<string, Container | undefined>)[SCOPE];
    if (existing) return resolve(existing);
    const script = document.createElement('script');
    script.src = REMOTE_ENTRY;
    script.async = true;
    script.onload = () => {
      const container = (window as unknown as Record<string, Container | undefined>)[SCOPE];
      if (container) resolve(container);
      else reject(new TypeError(\`\${REMOTE_ENTRY} did not define \${SCOPE}\`));
    };
    script.onerror = () => reject(new TypeError(\`could not load \${REMOTE_ENTRY}\`));
    document.head.appendChild(script);
  })
    // An island: the monolith shares nothing, so it gets an empty share scope.
    .then(async (container) => {
      await container.init({});
      const factory = await container.get(MODULE);
      return factory().mount;
    });
  return loading;
}

export interface ${cap}Props {
  [key: string]: unknown;
}

export const ${cap}: React.FC<${cap}Props> = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    let unmount: Unmount | undefined;
    void loadMount().then((mount) => {
      if (!live || !ref.current) return;
      unmount = mount(ref.current);
      // Assembled: decompose:capture waits while this says pending (ADR-113).
      ref.current.dataset.composition = 'ready';
    });
    return () => {
      live = false;
      unmount?.();
    };
  }, []);
  return <div ref={ref} data-legacy-app="${doc.app.name}" data-composition="pending" />;
};

export default ${cap};
`;
}

/**
 * What the monolith's own build needs (ADR-111 §1). The agent applies it: a
 * monolith's bundler config is its own code, and there is no general way to
 * edit one safely. `module` is a new file; `webpack` is the plugin to add.
 */
export function monolithFederationSnippet(doc: Decomposition): { module: string; webpack: string } {
  return {
    module: `// src/federation.tsx — the monolith's root, mountable from a shell (ADR-111).
// Render the same tree src/index.tsx renders, into the element the shell gives.
import React from 'react';
import { createRoot } from 'react-dom/client';
// import App, its router and its providers exactly as src/index.tsx does.

export function mount(element: HTMLElement): () => void {
  const root = createRoot(element);
  root.render(<React.StrictMode>{/* the tree src/index.tsx renders */}</React.StrictMode>);
  return () => root.unmount();
}
`,
    webpack: `// In the monolith's webpack config (webpack 5 or rspack):
const { ModuleFederationPlugin } = require('webpack').container;
// output.publicPath: 'auto' so the remote's chunks load from the monolith's origin;
// keep the page's own script tags absolute with HtmlWebpackPlugin({ publicPath: '/' }).
// devServer.headers: { 'Access-Control-Allow-Origin': '*' } so a shell on another port can load it.
new ModuleFederationPlugin({
  name: '${remoteScope(doc)}',
  filename: 'remoteEntry.js',
  exposes: { './mount': './src/federation.tsx' },
  // No shared: the monolith is an island with its own React (ADR-060).
}),
`,
  };
}
