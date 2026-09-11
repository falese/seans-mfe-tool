/**
 * The BFF's contribution to MFE code generation (ADR-092 §2).
 *
 * `remote:generate` emits BFF files into an MFE whose manifest declares a
 * `data:` section. Those files are the BFF's, not the core generator's — but
 * until the generator could accept a contribution, core reached into this
 * package by relative path (`../../../packages/plugin-bff/templates`) to render
 * them. That escaped codegen's package root, was undeclared, and pointed at a
 * package that depends on codegen: a cycle npm could not see, and the reason a
 * published `@seans-mfe/codegen` could not generate a BFF at all.
 *
 * Importing this module registers the contribution. `templateRoot` is resolved
 * here, inside the package that owns the templates, so the generator never
 * names this package.
 */

import * as path from 'path';
import * as yaml from 'js-yaml';
import { registerFileContributor, type FileSpec } from '@seans-mfe/codegen';

const BFF_DIR = 'src/platform/bff';

/** The plan context, as much of it as these specs read. */
interface BffCtx {
  manifest: {
    data?: {
      mockSwitch?: { enabled?: boolean };
      sources?: Array<{ name?: string; handler?: unknown }>;
      serve?: unknown;
    };
  };
  vars: { className?: string; port?: number };
  variant: { ownsRootTsconfig: boolean };
  hasBff: boolean;
}

const hasBff = (c: unknown): boolean => (c as BffCtx).hasBff;
const bffClassName = (c: unknown): Record<string, unknown> => ({
  bffClassName: `${(c as BffCtx).vars.className as string}BFF`,
});

/**
 * BFF port = MFE port + 1000 (3002 → 4002), following the e2e2 pattern. The
 * MFE and its BFF are one deployable unit: server.ts serves the remoteEntry
 * and /graphql from the same origin.
 */
const bffPort = (c: unknown): Record<string, unknown> => ({
  port: ((c as BffCtx).vars.port ?? 3000) + 1000,
  includeStatic: true,
});

const mockSwitchOn = (c: unknown): boolean =>
  hasBff(c) && !!(c as BffCtx).manifest.data?.mockSwitch?.enabled;

/**
 * `package.json` is deliberately absent. The MFE root template is already a
 * hybrid owning both MFE deps (rspack, react, MUI) and BFF deps (mesh,
 * express, helmet); this package's own `package.json.ejs` is a strict subset
 * and used to clobber it, leaving generated MFEs without MUI while
 * `src/App.tsx` imported it.
 *
 * `server.ts` is generator-owned — pure BFF runtime nobody customises. The
 * root files are developer-owned so customisation survives regeneration.
 */
export const BFF_SPECS: FileSpec[] = [
  {
    // .meshrc.yaml — the Mesh config, serialized from the manifest's data:
    // block before the template sees it. Mesh configuration is this plugin's
    // domain, so composing it here is what stops core knowing about Mesh.
    template: 'meshrc.yaml.ejs',
    out: '.meshrc.yaml',
    owner: 'generator',
    root: 'bff',
    when: hasBff,
    vars: (c) => {
      const data = (c as BffCtx).manifest.data;
      // Filter empty/invalid sources from pre-Zod YAML.
      const sources = (data?.sources ?? []).filter(
        (source) =>
          source && typeof source === 'object' && source.name && source.name.trim() && source.handler,
      );
      return {
        meshConfigYaml: yaml.dump(
          { sources, serve: data?.serve || { endpoint: '/graphql', playground: true } },
          { noRefs: true, lineWidth: -1 },
        ),
      };
    },
  },
  { template: 'bff.ts.ejs', out: `${BFF_DIR}/bff.ts`, owner: 'generator', root: 'bff', when: hasBff, vars: bffClassName },
  { template: 'bff.test.ts.ejs', out: `${BFF_DIR}/bff.test.ts`, owner: 'generator', root: 'bff', when: hasBff, vars: bffClassName },
  // Context-injection Envelop plugin (ADR-027); .meshrc.yaml references it as
  // ./src/platform/bff/mesh-context.js.
  { template: 'mesh-context.js.ejs', out: `${BFF_DIR}/mesh-context.js`, owner: 'generator', root: 'bff', when: hasBff },
  // Demo-mode mock switch (ADR-052), a resolversComposition transform.
  { template: 'mock-switch.js.ejs', out: `${BFF_DIR}/mock-switch.js`, owner: 'generator', root: 'bff', when: mockSwitchOn },
  { template: 'mocks.json.ejs', out: `${BFF_DIR}/mocks.json`, owner: 'developer', root: 'bff', when: mockSwitchOn },
  { template: 'server.ts.ejs', out: 'server.ts', owner: 'generator', root: 'bff', when: hasBff, vars: bffPort, optional: true },
  {
    // Skipped for a variant shipping its own — the Angular tsconfig carries
    // experimentalDecorators and angularCompilerOptions the generic one lacks.
    template: 'tsconfig.json',
    out: 'tsconfig.json',
    owner: 'developer',
    root: 'bff',
    when: (c) => hasBff(c) && !(c as BffCtx).variant.ownsRootTsconfig,
    vars: bffPort,
    optional: true,
  },
  { template: 'Dockerfile.ejs', out: 'Dockerfile', owner: 'developer', root: 'bff', when: hasBff, vars: bffPort, optional: true },
  { template: 'docker-compose.yaml.ejs', out: 'docker-compose.yaml', owner: 'developer', root: 'bff', when: hasBff, vars: bffPort, optional: true },
  { template: 'README.md.ejs', out: 'README.md', owner: 'developer', root: 'bff', when: hasBff, vars: bffPort, optional: true },
];

/** Absolute, resolved inside this package. From dist/ that is ../templates. */
export const bffTemplateRoot = path.resolve(__dirname, '..', 'templates');

registerFileContributor({ id: 'bff', templateRoot: bffTemplateRoot, specs: BFF_SPECS });
