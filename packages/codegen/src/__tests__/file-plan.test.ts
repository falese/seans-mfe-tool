/**
 * The file plan — the generic emit loop that replaces ~25 hand-written
 * `files.push` sites (ADR-091, extraction plan Phase 4).
 *
 * These tests pin the loop's contract rather than any particular variant's
 * plan: what `when` gates, how `optional` differs from a missing template,
 * where ownership comes from, and that a spec can name its own template root.
 * A variant's plan is data checked by the characterization baseline; this is
 * the machine that reads it.
 */

import { resolveFilePlan, type FileSpec, type PlanIO } from '../file-plan';

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
