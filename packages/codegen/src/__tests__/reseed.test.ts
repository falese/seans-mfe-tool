/**
 * `--force` re-seeds developer-owned scaffolding (ADR-089).
 *
 * ADR-043 splits every emitted file into generator-owned (`overwrite: true`,
 * re-stamped every run) and developer-owned (`overwrite: false`, seeded once).
 * ADR-082 exists because the second half is unreachable by regeneration: a
 * platform change that lands in developer-owned code can only be *reported*.
 *
 * These tests pin the third state ADR-089 adds — an explicit, opt-in re-seed —
 * and, just as importantly, pin what it still refuses to touch.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { writeGeneratedFiles } from '../template-io';
import type { GeneratedFile } from '../unified-generator';

const generated = (p: string, content: string): GeneratedFile => ({
  path: p,
  content,
  overwrite: true,
});
const developerOwned = (p: string, content: string): GeneratedFile => ({
  path: p,
  content,
  overwrite: false,
});

describe('writeGeneratedFiles — re-seed semantics (ADR-089)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reseed-'));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  const seed = async (name: string, content: string): Promise<string> => {
    const p = path.join(dir, name);
    await fs.outputFile(p, content);
    return p;
  };

  describe('without --force (the default, unchanged)', () => {
    it('leaves an existing developer-owned file alone', async () => {
      const p = await seed('App.tsx', 'MY EDIT');
      const result = await writeGeneratedFiles([developerOwned(p, 'FRESH')]);

      expect(await fs.readFile(p, 'utf8')).toBe('MY EDIT');
      expect(result.skipped).toEqual([p]);
      expect(result.files).toEqual([]);
    });

    it('still re-stamps an existing generator-owned file', async () => {
      // Unconditional, and it has to be: ADR-043 idempotent regeneration and
      // check:mfe-drift both require a generator-owned file to match a fresh
      // generation at all times. This never depended on --force.
      const p = await seed('mfe.ts', 'OLD');
      await writeGeneratedFiles([generated(p, 'FRESH')]);

      expect(await fs.readFile(p, 'utf8')).toBe('FRESH');
    });
  });

  describe('with --force', () => {
    it('re-seeds an existing developer-owned file', async () => {
      const p = await seed('App.tsx', 'MY EDIT');
      const result = await writeGeneratedFiles([developerOwned(p, 'FRESH')], { force: true });

      expect(await fs.readFile(p, 'utf8')).toBe('FRESH');
      expect(result.skipped).toEqual([]);
      expect(result.files.map((f) => f.path)).toEqual([p]);
    });

    it('reports re-seeded developer-owned files separately from routine writes', async () => {
      // The whole risk of this flag is destroying an edit. A caller that cannot
      // distinguish "wrote a new file" from "overwrote your work" cannot warn
      // about it, so the writer says which is which.
      const mine = await seed('App.tsx', 'MY EDIT');
      const theirs = await seed('mfe.ts', 'OLD');
      const fresh = path.join(dir, 'new.tsx');

      const result = await writeGeneratedFiles(
        [developerOwned(mine, 'FRESH'), generated(theirs, 'FRESH'), developerOwned(fresh, 'FRESH')],
        { force: true },
      );

      expect(result.reseeded).toEqual([mine]);
      expect(result.files.map((f) => f.path).sort()).toEqual([mine, theirs, fresh].sort());
    });

    it('creates a developer-owned file that does not exist yet, without calling it a re-seed', async () => {
      const p = path.join(dir, 'App.tsx');
      const result = await writeGeneratedFiles([developerOwned(p, 'FRESH')], { force: true });

      expect(await fs.readFile(p, 'utf8')).toBe('FRESH');
      expect(result.reseeded).toEqual([]);
    });

    it('writes nothing under --dry-run', async () => {
      const p = await seed('App.tsx', 'MY EDIT');
      const result = await writeGeneratedFiles([developerOwned(p, 'FRESH')], {
        force: true,
        dryRun: true,
      });

      expect(await fs.readFile(p, 'utf8')).toBe('MY EDIT');
      expect(result.reseeded).toEqual([p]);
      expect(result.files.map((f) => f.path)).toEqual([p]);
    });
  });

  describe('the boundary --force does not cross', () => {
    it('cannot reach a capability whose feature file is already implemented', async () => {
      // ADR-089 §3. This is not enforced here — it is enforced upstream, by
      // generateAllFiles omitting an implemented capability's files from the
      // plan entirely rather than marking them. A file that never enters the
      // plan cannot be re-seeded by a writer that only walks the plan.
      //
      // Pinned as a writer-level property so the protection cannot be lost by
      // someone "fixing" the writer: given an empty plan, --force writes nothing.
      const p = await seed('src/features/Flappy/Flappy.tsx', 'MY GAME LOGIC');
      const result = await writeGeneratedFiles([], { force: true });

      expect(await fs.readFile(p, 'utf8')).toBe('MY GAME LOGIC');
      expect(result.files).toEqual([]);
      expect(result.reseeded).toEqual([]);
    });
  });
});
