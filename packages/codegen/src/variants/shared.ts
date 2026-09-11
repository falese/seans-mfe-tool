/**
 * Specs every variant gets: the platform contract files, the BFF, the public
 * assets, and the per-capability feature scaffolding.
 *
 * These are shared because their *output paths* are variant-independent —
 * `src/platform/base-mfe/mfe.ts` is the same address in a React MFE and an
 * Angular one. Their templates still come from the variant's own directory,
 * which is what makes `mfe.ts.ejs` able to emit different code per framework
 * without this list knowing anything about frameworks.
 */

import type { FileSpec } from '../file-plan';
import type { GenPlanContext } from './types';
import { toDeclaredSlotIdUnion } from '../slot-types';

const PLATFORM_DIR = 'src/platform/base-mfe';
const BFF_DIR = 'src/platform/bff';

/**
 * The BaseMFE lifecycle contract — the files generated code imports from.
 * All generator-owned: they are the platform's half of the deal, re-stamped
 * every run and held byte-identical by `check:mfe-drift`.
 */
export const PLATFORM_SPECS: FileSpec[] = [
  { template: 'mfe.ts.ejs', out: `${PLATFORM_DIR}/mfe.ts`, owner: 'generator' },
  {
    // ADR-040: only when a lifecycle hook declared a `source`. Without one the
    // registry is absent and the generated mfe.ts is unchanged (back-compat).
    template: 'handler-registry.ts.ejs',
    out: `${PLATFORM_DIR}/handler-registry.ts`,
    owner: 'generator',
    when: (c) => (c as GenPlanContext).handlerSources.length > 0,
  },
  {
    // Regenerated every run so the inline manifest stays in step with
    // mfe-manifest.yaml. Bootstrap is glue — instantiate, load, log;
    // customization belongs in mfe.ts overrides, hooks, or `deps.*` DI.
    template: 'bootstrap.ts.ejs',
    out: `${PLATFORM_DIR}/bootstrap.ts`,
    owner: 'generator',
  },
  { template: 'mfe.test.ts.ejs', out: `${PLATFORM_DIR}/mfe.test.ts`, owner: 'generator' },
  { template: 'types.ts.ejs', out: `${PLATFORM_DIR}/types.ts`, owner: 'generator' },
];

const hasBff = (c: unknown): boolean => (c as GenPlanContext).hasBff;
const bffClassName = (c: unknown): Record<string, unknown> => ({
  bffClassName: `${(c as GenPlanContext).vars.className as string}BFF`,
});

/**
 * BFF port = MFE port + 1000 (3002 → 4002), following the e2e2 pattern. The
 * MFE and its BFF are one deployable unit: server.ts serves the remoteEntry
 * and /graphql from the same origin.
 */
const bffPort = (c: unknown): Record<string, unknown> => ({
  port: (((c as GenPlanContext).vars.port as number | undefined) ?? 3000) + 1000,
  includeStatic: true,
});

/**
 * Emitted only when the manifest declares a `data:` section.
 *
 * `package.json` is deliberately absent. The MFE root template is already a
 * hybrid owning both MFE deps (rspack, react, MUI) and BFF deps (mesh,
 * express, helmet); the BFF template's own `package.json.ejs` is a strict
 * subset and used to clobber it, leaving generated MFEs without MUI while
 * `src/App.tsx` imported it.
 *
 * `server.ts` is generator-owned — pure BFF runtime nobody customises. The
 * rest are developer-owned so customisation survives regeneration.
 */
export const BFF_SPECS: FileSpec[] = [
  {
    template: 'bff.ts.ejs',
    out: `${BFF_DIR}/bff.ts`,
    owner: 'generator',
    root: 'bff',
    when: hasBff,
    vars: bffClassName,
  },
  {
    template: 'bff.test.ts.ejs',
    out: `${BFF_DIR}/bff.test.ts`,
    owner: 'generator',
    root: 'bff',
    when: hasBff,
    vars: bffClassName,
  },
  {
    // Context-injection Envelop plugin (ADR-027). .meshrc.yaml references it
    // as ./src/platform/bff/mesh-context.js.
    template: 'mesh-context.js.ejs',
    out: `${BFF_DIR}/mesh-context.js`,
    owner: 'generator',
    root: 'bff',
    when: hasBff,
  },
  {
    // Demo-mode mock switch (ADR-052), a resolversComposition transform.
    template: 'mock-switch.js.ejs',
    out: `${BFF_DIR}/mock-switch.js`,
    owner: 'generator',
    root: 'bff',
    when: (c) => hasBff(c) && !!(c as GenPlanContext).manifest.data?.mockSwitch?.enabled,
  },
  {
    template: 'mocks.json.ejs',
    out: `${BFF_DIR}/mocks.json`,
    owner: 'developer',
    root: 'bff',
    when: (c) => hasBff(c) && !!(c as GenPlanContext).manifest.data?.mockSwitch?.enabled,
  },
  {
    template: 'server.ts.ejs',
    out: 'server.ts',
    owner: 'generator',
    root: 'bff',
    when: hasBff,
    vars: bffPort,
    optional: true,
  },
  {
    // Skipped for a variant that ships its own — the Angular tsconfig carries
    // experimentalDecorators and angularCompilerOptions the generic one lacks.
    template: 'tsconfig.json',
    out: 'tsconfig.json',
    owner: 'developer',
    root: 'bff',
    when: (c) => hasBff(c) && !(c as GenPlanContext).variant.ownsRootTsconfig,
    vars: bffPort,
    optional: true,
  },
  {
    template: 'Dockerfile.ejs',
    out: 'Dockerfile',
    owner: 'developer',
    root: 'bff',
    when: hasBff,
    vars: bffPort,
    optional: true,
  },
  {
    template: 'docker-compose.yaml.ejs',
    out: 'docker-compose.yaml',
    owner: 'developer',
    root: 'bff',
    when: hasBff,
    vars: bffPort,
    optional: true,
  },
  {
    template: 'README.md.ejs',
    out: 'README.md',
    owner: 'developer',
    root: 'bff',
    when: hasBff,
    vars: bffPort,
    optional: true,
  },
];

/**
 * Public assets. `demo.html` and `favicon.ico` are optional: a variant may
 * legitimately not ship them (an Angular MFE is served through the Angular
 * builder and has no standalone demo page), and warning about that printed two
 * lines per Angular MFE on every run.
 */
export const PUBLIC_SPECS: FileSpec[] = [
  { template: 'public/index.html.ejs', out: 'public/index.html', owner: 'generator' },
  {
    template: 'public/demo.html.ejs',
    out: 'public/demo.html',
    owner: 'generator',
    optional: true,
    vars: (c) => ({ capabilities: (c as GenPlanContext).domainCapabilities }),
  },
  {
    template: 'public/favicon.ico.ejs',
    out: 'public/favicon.ico',
    owner: 'generator',
    optional: true,
  },
];

/** Jest static-asset mock, required by the generated config's moduleNameMapper. */
export const FILE_MOCK_SPEC: FileSpec = {
  content: 'module.exports = "test-file-stub";\n',
  out: '__mocks__/fileMock.js',
  owner: 'developer',
};

/**
 * The slot contract sugar (ADR-067), when the manifest declares slots and the
 * variant ships a template for it.
 *
 * Always generator-owned so the code can never register a slot id the manifest
 * does not declare — declaration and behaviour share one source.
 */
export function slotSpecs(ctx: GenPlanContext): FileSpec[] {
  const provides = ctx.manifest.providesSlots;
  if (!provides?.length || !ctx.variant.slots) return [];
  return [
    {
      template: ctx.variant.slots.template,
      out: ctx.variant.slots.out,
      owner: 'generator',
      vars: () => ({
        providesSlots: provides,
        // ADR-072: the ids are emitted as a type, not only as data, so a
        // manifest rename is a compile error at every use site.
        declaredSlotIdUnion: toDeclaredSlotIdUnion(provides),
      }),
    },
  ];
}

/**
 * One capability's three files: the component, its barrel, and its test.
 *
 * All developer-owned — this is domain implementation, not scaffolding the
 * platform can rebuild, which is why `--force` cannot reach them either
 * (ADR-089 §3). A capability already realised in code is omitted entirely by
 * the caller rather than emitted and skipped.
 */
export function featureSpecs(ctx: GenPlanContext, capability: string): FileSpec[] {
  const names = ctx.variant.featureFiles(capability);
  const dir = `src/features/${capability}`;
  const description =
    (ctx.manifest.capabilities.find((e) => capability in e)?.[capability]?.description as
      | string
      | undefined) || `${capability} feature component`;

  return [
    {
      template: `features/${names.componentTemplate}`,
      out: `${dir}/${names.component}`,
      owner: 'developer',
      vars: () => ({ name: capability, description }),
    },
    {
      template: 'features/index.ts.ejs',
      out: `${dir}/index.ts`,
      owner: 'developer',
      vars: () => ({ name: capability }),
    },
    {
      template: `features/${names.specTemplate}`,
      out: `${dir}/${names.spec}`,
      owner: 'developer',
      vars: () => ({ name: capability }),
    },
  ];
}
