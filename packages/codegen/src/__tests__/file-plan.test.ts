/**
 * The file plan — the generic emit loop that replaces ~25 hand-written
 * `files.push` sites (ADR-093, extraction plan Phase 4).
 *
 * These tests pin the loop's contract rather than any particular variant's
 * plan: what `when` gates, how `optional` differs from a missing template,
 * where ownership comes from, and that a spec can name its own template root.
 * A variant's plan is data checked by the characterization baseline; this is
 * the machine that reads it.
 */

import {
  resolveFilePlan,
  mergeTemplateRoots,
  type FileSpec,
  type PlanIO,
} from '../file-plan';

/** A PlanIO whose template set and render output are fully controlled. */
function fakeIO(present: Record<string, string>): PlanIO & { rendered: string[] } {
  const rendered: string[] = [];
  return {
    rendered,
    exists: async (p: string) => p in present,
    render: async (p: string, vars: Record<string, unknown>) => {
      rendered.push(p);
      return `${present[p]}|${JSON.stringify(vars)}`;
    },
  };
}

const ctx = { marker: 'ctx' } as unknown as never;

describe('resolveFilePlan', () => {
  it('emits one file per spec, resolving template and output against their roots', async () => {
    const io = fakeIO({ '/tpl/a.ejs': 'A' });
    const { files } = await resolveFilePlan(
      [{ template: 'a.ejs', out: 'src/a.ts', owner: 'generator' }],
      { basePath: '/out', roots: { variant: '/tpl' }, vars: {}, ctx, io },
    );

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('/out/src/a.ts');
    expect(files[0].content.startsWith('A|')).toBe(true);
  });

  it('maps owner onto the overwrite flag, which is the ownership map', async () => {
    const io = fakeIO({ '/tpl/a.ejs': 'A', '/tpl/b.ejs': 'B' });
    const { files } = await resolveFilePlan(
      [
        { template: 'a.ejs', out: 'a', owner: 'generator' },
        { template: 'b.ejs', out: 'b', owner: 'developer' },
      ],
      { basePath: '/out', roots: { variant: '/tpl' }, vars: {}, ctx, io },
    );

    expect(files.map((f) => f.overwrite)).toEqual([true, false]);
  });

  it('skips a spec whose `when` is false, without touching its template', async () => {
    const io = fakeIO({ '/tpl/a.ejs': 'A' });
    const { files } = await resolveFilePlan(
      [{ template: 'a.ejs', out: 'a', owner: 'generator', when: () => false }],
      { basePath: '/out', roots: { variant: '/tpl' }, vars: {}, ctx, io },
    );

    expect(files).toEqual([]);
    expect(io.rendered).toEqual([]);
  });

  it('merges per-spec vars over the shared model', async () => {
    const io = fakeIO({ '/tpl/a.ejs': 'A' });
    const { files } = await resolveFilePlan(
      [{ template: 'a.ejs', out: 'a', owner: 'generator', vars: () => ({ port: 4002 }) }],
      { basePath: '/out', roots: { variant: '/tpl' }, vars: { port: 3002, name: 'x' }, ctx, io },
    );

    const passed = JSON.parse(files[0].content.split('|')[1]) as Record<string, unknown>;
    expect(passed).toEqual({ port: 4002, name: 'x' });
  });

  it('resolves a spec against the root it names', async () => {
    const io = fakeIO({ '/bff/server.ts.ejs': 'S' });
    const { files } = await resolveFilePlan(
      [{ template: 'server.ts.ejs', out: 'server.ts', owner: 'generator', root: 'bff' }],
      { basePath: '/out', roots: { variant: '/tpl', bff: '/bff' }, vars: {}, ctx, io },
    );

    expect(files[0].path).toBe('/out/server.ts');
    expect(io.rendered).toEqual(['/bff/server.ts.ejs']);
  });
});

describe('a missing template', () => {
  const missing: FileSpec = { template: 'gone.ejs', out: 'gone.ts', owner: 'generator' };

  it('is reported as a diagnostic, and emits nothing', async () => {
    const io = fakeIO({});
    const { files, diagnostics } = await resolveFilePlan([missing], {
      basePath: '/out',
      roots: { variant: '/tpl' },
      vars: {},
      ctx,
      io,
    });

    expect(files).toEqual([]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].message).toContain('gone.ejs');
  });

  it('is silent when the spec marks it optional', async () => {
    // A variant legitimately omitting an asset is a choice, not a defect —
    // base-mfe-angular ships no demo.html or favicon, and warning about it
    // printed two lines per Angular MFE on every run.
    const io = fakeIO({});
    const { files, diagnostics } = await resolveFilePlan([{ ...missing, optional: true }], {
      basePath: '/out',
      roots: { variant: '/tpl' },
      vars: {},
      ctx,
      io,
    });

    expect(files).toEqual([]);
    expect(diagnostics).toEqual([]);
  });
});

describe('literal content', () => {
  it('emits a spec that carries content instead of a template', async () => {
    // __mocks__/fileMock.js has no template — it was a hardcoded string in the
    // middle of renderFiles. As a spec it stops being a special case.
    const io = fakeIO({});
    const { files, diagnostics } = await resolveFilePlan(
      [{ content: 'module.exports = "x";\n', out: '__mocks__/fileMock.js', owner: 'developer' }],
      { basePath: '/out', roots: { variant: '/tpl' }, vars: {}, ctx, io },
    );

    expect(files).toEqual([
      { path: '/out/__mocks__/fileMock.js', content: 'module.exports = "x";\n', overwrite: false },
    ]);
    expect(diagnostics).toEqual([]);
    expect(io.rendered).toEqual([]);
  });
});

describe('the ownership table', () => {
  it('is derivable from the plan without rendering anything', async () => {
    // Three subsystems need the ownership split (drift gate, mfe:validate's
    // developerOwned predicate, the dry-run planner) and each used to infer it
    // separately. The plan is the one place it is stated.
    const { ownershipOf } = await import('../file-plan');
    const plan: FileSpec[] = [
      { template: 'a.ejs', out: 'src/a.ts', owner: 'generator' },
      { template: 'b.ejs', out: 'src/App.tsx', owner: 'developer' },
    ];

    expect(ownershipOf(plan)).toEqual({ 'src/a.ts': 'generator', 'src/App.tsx': 'developer' });
  });
});

describe('mergeTemplateRoots', () => {
  // The root table is `{ variant: templateDir, ...contributorRoots }`, keyed by
  // contributor id — and `FileContributor.id` is an open string while `variant`
  // is the reserved name every spec falls back to. A contributor registering
  // under that id silently replaced the variant's own template directory, so
  // every spec with no explicit `root` (the majority) would render from the
  // contributor's package instead.
  //
  // The failure mode is not an error. It is a complete MFE generated from the
  // wrong templates, which is why this is an error diagnostic and not a warning.
  const VARIANT_ROOT = '/tpl/variant';

  it('maps each contributor id to its own template root', () => {
    const { roots, diagnostics } = mergeTemplateRoots(VARIANT_ROOT, [
      { id: 'bff', templateRoot: '/pkg/bff/templates' },
      { id: 'api', templateRoot: '/pkg/api/templates' },
    ]);

    expect(roots).toEqual({
      variant: VARIANT_ROOT,
      bff: '/pkg/bff/templates',
      api: '/pkg/api/templates',
    });
    expect(diagnostics).toEqual([]);
  });

  it('refuses to let a contributor claim the reserved "variant" root', () => {
    const { roots, diagnostics } = mergeTemplateRoots(VARIANT_ROOT, [
      { id: 'variant', templateRoot: '/pkg/hijack/templates' },
    ]);

    expect(roots.variant).toBe(VARIANT_ROOT);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].code).toBe('reserved-template-root');
    expect(diagnostics[0].target).toBe('variant');
  });

  it('keeps the other contributors when one collides', () => {
    const { roots, diagnostics } = mergeTemplateRoots(VARIANT_ROOT, [
      { id: 'variant', templateRoot: '/pkg/hijack/templates' },
      { id: 'bff', templateRoot: '/pkg/bff/templates' },
    ]);

    expect(roots.bff).toBe('/pkg/bff/templates');
    expect(roots.variant).toBe(VARIANT_ROOT);
    expect(diagnostics).toHaveLength(1);
  });

  it('reports a duplicate contributor id rather than letting the last one win', () => {
    const { roots, diagnostics } = mergeTemplateRoots(VARIANT_ROOT, [
      { id: 'bff', templateRoot: '/pkg/bff/templates' },
      { id: 'bff', templateRoot: '/pkg/other/templates' },
    ]);

    expect(roots.bff).toBe('/pkg/bff/templates');
    expect(diagnostics.map((d) => d.code)).toEqual(['duplicate-template-root']);
  });

  it('a spec with no explicit root still resolves against the variant', async () => {
    const { roots } = mergeTemplateRoots(VARIANT_ROOT, [
      { id: 'variant', templateRoot: '/pkg/hijack/templates' },
    ]);
    const { files } = await resolveFilePlan(
      [{ template: 'a.ejs', out: 'a.ts', owner: 'generator' }] as FileSpec[],
      {
        basePath: '/out',
        roots,
        vars: {},
        ctx: undefined,
        io: { exists: async () => true, render: async (p: string) => p },
      },
    );

    expect(files[0].content).toBe('/tpl/variant/a.ejs');
  });
});

describe('the template-root table is not prototype-bearing', () => {
  // `roots[spec.root]` on a plain object returns the INHERITED member for
  // `toString`, which is not undefined — so `resolveFilePlan`'s
  // `root === undefined` guard never fires and the spec fails later, as a
  // misleading `missing-template`, against a garbage path.
  it('reports an unknown root as unknown, not as a missing template', async () => {
    const { roots } = mergeTemplateRoots('/tpl/variant', []);
    const { files, diagnostics } = await resolveFilePlan(
      [{ template: 'a.ejs', out: 'a.ts', owner: 'generator', root: 'toString' }] as FileSpec[],
      {
        basePath: '/out',
        roots,
        vars: {},
        ctx: undefined,
        io: { exists: async () => true, render: async (p: string) => p },
      },
    );

    expect(files).toEqual([]);
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-template-root']);
  });

  it('registers a contributor whose id is __proto__ as a real key', () => {
    // `roots['__proto__'] = x` on an object literal sets the PROTOTYPE, so the
    // id was accepted, stored nowhere, and reported as nothing.
    const { roots, diagnostics } = mergeTemplateRoots('/tpl/variant', [
      { id: '__proto__', templateRoot: '/pkg/odd/templates' },
    ]);

    expect(diagnostics).toEqual([]);
    expect(roots['__proto__']).toBe('/pkg/odd/templates');
    expect(Object.keys(roots).sort()).toEqual(['__proto__', 'variant']);
  });
});
