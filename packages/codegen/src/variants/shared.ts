/**
 * Specs every variant gets: the platform contract files, the public assets,
 * and the per-capability feature scaffolding.
 *
 * The BFF's specs used to live here too. They are a plugin's, and now live in
 * `@seans-mfe/plugin-bff` as a FileContributor (ADR-092 §2) — which is what
 * removed the relative-path escape from this package into that one.
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

/**
 * Escape a capability name for use inside a RegExp.
 *
 * Lives here rather than once per variant: it was copied verbatim into both
 * built-ins, and a variant author copying a third time is how the escaping
 * eventually gets dropped from one of them. A capability name is manifest text
 * — `Order.Detail` or `A+B` compile to a pattern that matches the wrong files
 * unescaped.
 */
export function escapeCapabilityName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
