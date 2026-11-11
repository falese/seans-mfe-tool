/**
 * The fleet's shell: a generic LayoutManager host (ADR-055), with nothing of
 * its own on screen.
 *
 * It is meridian-station's shell less its chrome. The parity gate compares the
 * composed app to the monolith region by region and accepts a wrapper only
 * when it shows no text (ADR-113), so this shell renders an empty host element
 * and keeps the monolith's page styles: its `<head>` styles are copied from the
 * monolith's `public/index.html`, because regions are compared by their pixels
 * and a transparent region shows the page behind it.
 *
 * It knows its project's root state key and sends it once the control plane is
 * connected; everything it then shows arrives from the daemon. Developer-owned
 * once written: scaffold seeds it and never overwrites it.
 */

import { CONTROL_PLANE_PATH } from '../bundle';

export interface ShellOptions {
  /** The project's control-plane namespace; the shell starts in `<namespace>.root`. */
  namespace: string;
  title: string;
  port: number;
  daemonWsUrl: string;
  /** `<style>`/`<link>` elements from the monolith's page head, kept verbatim. */
  headStyles: string;
  /** Path prefixes the shell forwards to the monolith's dev server, e.g. `/api`. */
  proxy: { context: string[]; target: string } | null;
}

/** The `<style>` and stylesheet `<link>` elements of an HTML document's head. */
export function headStylesOf(html: string): string {
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
  const parts = head.match(/<style[\s\S]*?<\/style>|<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi) ?? [];
  return parts.map((p) => p.trim()).join('\n    ');
}

export function shellFiles(o: ShellOptions): Record<string, string> {
  const pkg = {
    name: `${o.namespace}-shell`,
    version: '0.1.0',
    private: true,
    description: `${o.title} — generic LayoutManager shell, written by decompose:scaffold (ADR-055, ADR-111)`,
    scripts: { dev: 'rspack serve', build: 'rspack build' },
    dependencies: { react: '~18.2.0', 'react-dom': '~18.2.0', '@seans-mfe-tool/runtime': '^0.1.0' },
    devDependencies: {
      '@rspack/cli': '^1.7.0',
      '@rspack/core': '^1.7.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      typescript: '^5.3.3',
    },
  };
  const daemonHttp = new URL(o.daemonWsUrl.replace(/^ws/, 'http')).origin;
  const proxies = [
    // The daemon's HTTP endpoint takes the shell's one STATE_UPDATE; it sends no CORS headers,
    // so the page reaches it through its own origin.
    `{ context: ['${CONTROL_PLANE_PATH}'], target: process.env.DAEMON_HTTP_URL || '${daemonHttp}', pathRewrite: { '^${CONTROL_PLANE_PATH}': '' } }`,
    ...(o.proxy
      ? [
          // The monolith calls its backends on its own origin; while it is composed, the page's
          // origin is the shell's, so those calls are forwarded to the monolith's dev server.
          `{ context: ${JSON.stringify(o.proxy.context)}, target: process.env.LEGACY_URL || '${o.proxy.target}', changeOrigin: true }`,
        ]
      : []),
  ];
  const proxy = `\n    proxy: [\n      ${proxies.join(',\n      ')},\n    ],`;
  return {
    'package.json': `${JSON.stringify(pkg, null, 2)}\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['src'],
      },
      null,
      2
    )}\n`,
    'rspack.config.js': `const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

module.exports = {
  // React's production build unless SHELL_REACT_ENV=development: the remotes it composes are
  // production builds, and a development react-dom shared with them warns on every mount — a
  // console error the parity gate counts. Not NODE_ENV: 'rspack serve' sets that to development.
  mode: 'production',
  optimization: { nodeEnv: process.env.SHELL_REACT_ENV || 'production' },
  entry: './src/index.tsx',
  output: { path: path.resolve(__dirname, 'dist'), publicPath: '/', clean: true },
  resolve: { extensions: ['.ts', '.tsx', '.js'] },
  module: {
    rules: [
      {
        test: /\\.(ts|tsx)$/,
        use: { loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } } } },
      },
    ],
  },
  devServer: {
    port: ${o.port},
    historyApiFallback: true,
    headers: { 'Access-Control-Allow-Origin': '*' },${proxy}
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.DAEMON_WS_URL': JSON.stringify(process.env.DAEMON_WS_URL || '${o.daemonWsUrl}'),
    }),
    new rspack.HtmlRspackPlugin({ template: path.join(__dirname, 'public/index.html'), inject: true }),
    // No static remotes: every MFE arrives through the control plane (ADR-055).
    new ModuleFederationPlugin({
      name: '${o.namespace.replace(/[^A-Za-z0-9_]/g, '_')}_shell',
      remotes: {},
      shared: {
        react: { singleton: true, requiredVersion: '~18.2.0', eager: true },
        'react-dom': { singleton: true, requiredVersion: '~18.2.0', eager: true },
      },
    }),
  ],
};
`,
    'public/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${o.title}</title>
    ${o.headStyles}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
    'src/index.tsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) createRoot(container).render(<App />);
`,
    'src/App.tsx': `/**
 * ${o.title} shell — a generic, daemon-driven layout host (ADR-055).
 *
 * It knows no MFE. It starts the project in ${o.namespace}.root once the
 * control plane is connected, and mounts whatever the daemon publishes. It
 * shows nothing of its own: the connection state is on attributes, not on
 * screen, so the parity gate compares only what the MFEs draw (ADR-113).
 */
import React, { useEffect, useRef } from 'react';
import { GraphQLTransportWsDaemonTransport, LayoutManager, type WebSocketLike } from '@seans-mfe-tool/runtime';

declare const process: { env: { DAEMON_WS_URL?: string } };
const DAEMON_WS_URL: string = process.env.DAEMON_WS_URL || '${o.daemonWsUrl}';
const ROOT_STATE = '${o.namespace}.root';

/** Ask the control plane for the root experience: a STATE_UPDATE action (ADR-054). */
async function enterRoot(sessionId: string): Promise<void> {
  const id = \`\${ROOT_STATE}-\${Date.now()}\`;
  const message = {
    direction: 'ACTION',
    kind: 'ACTION',
    payload: {
      id,
      componentId: 'shell',
      actionType: 'STATE_UPDATE',
      stateKey: ROOT_STATE,
      data: {},
      timestamp: new Date().toISOString(),
      context: { sessionId, application: 'web' },
    },
    metadata: { correlationId: id, acknowledged: false, error: null },
  };
  await fetch('${CONTROL_PLANE_PATH}/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'mutation($m:String!){sendMessage(message:$m)}', variables: { m: JSON.stringify(message) } }),
  });
}

const App: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    // Until the first experience arrives, the page is still assembling: decompose:capture waits on this.
    host.dataset.composition = 'pending';
    const arrived = new MutationObserver(() => {
      if (host.childElementCount > 0) {
        host.dataset.composition = 'ready';
        arrived.disconnect();
      }
    });
    arrived.observe(host, { childList: true });
    const sessionId = \`shell-\${Date.now()}-\${Math.random().toString(36).slice(2)}\`;
    let entered = false;
    const manager = new LayoutManager({
      container: host,
      transport: new GraphQLTransportWsDaemonTransport(
        DAEMON_WS_URL,
        (url, protocol) => new WebSocket(url, protocol) as unknown as WebSocketLike
      ),
      session: { sessionId, application: 'web' },
      hostFramework: 'react',
      onStatus: (status) => {
        host.dataset.controlPlane = status;
        if (status === 'connected' && !entered) {
          entered = true;
          void enterRoot(sessionId);
        }
      },
      onError: (error) => {
        host.dataset.controlPlaneError = error;
      },
    });
    manager.start();
    return () => {
      arrived.disconnect();
      void manager.stop();
    };
  }, []);

  return <div ref={hostRef} data-testid="layout-host" className="layout-host" />;
};

export default App;
`,
  };
}
