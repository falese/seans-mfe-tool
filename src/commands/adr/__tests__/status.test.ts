/**
 * adr:status command-core tests.
 *
 * The rules in `@seans-mfe/dsl` are covered by `adr-validation.test.ts`, but the
 * *reporting* logic — the `outstanding` predicate, the status filter, the
 * empty-set messaging, and root resolution — lives here in the command shell and
 * had no coverage. Three presentation defects reached `main` as a result:
 * a filtered run with no matches announced "nothing outstanding", `--status` was
 * case-sensitive against a core that compares case-insensitively, and the command
 * only worked from the repo root.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { adrStatusCommand } from '../status';
import { ValidationError } from '@seans-mfe/contracts';

const ADR_DIR = path.join('docs', 'architecture-decisions');

interface AdrFixture {
  id: string;
  title: string;
  status: string;
  area?: string;
  impl?: { stage: string; refs: string[] };
  implementedBy?: string[];
}

async function writeAdr(root: string, fx: AdrFixture): Promise<void> {
  const dir = path.join(root, ADR_DIR);
  await fs.ensureDir(dir);
  // Only populated keys are emitted. A bare `verified-by:` parses as null, and the
  // schema's `.default([])` only fills `undefined` — so an "empty" key is a parse
  // failure, not an empty list.
  const lines = [
    '---',
    `id: "${fx.id}"`,
    `title: >-`,
    `  ${fx.title}`,
    `status: ${fx.status}`,
    `area: ${fx.area ?? 'runtime'}`,
    'enforcement: none',
    'date: 2026-01-01',
  ];
  if (fx.impl) {
    lines.push('impl:');
    lines.push(`  stage: ${fx.impl.stage}`);
    lines.push('  refs:');
    for (const ref of fx.impl.refs) lines.push(`    - "${ref}"`);
  }
  if (fx.implementedBy?.length) {
    lines.push('implemented-by:');
    for (const p of fx.implementedBy) lines.push(`  - ${p}`);
  }
  lines.push('---', '', `# ADR-${fx.id}`, '', 'Body.', '');
  await fs.writeFile(path.join(dir, `ADR-${fx.id}-fixture.md`), lines.join('\n'));
}

/** A register with one of each interesting shape, and zero Superseded/Withdrawn. */
async function writeRegister(root: string): Promise<void> {
  await writeAdr(root, { id: '001', title: 'Done thing', status: 'Implemented', implementedBy: ['package.json'] });
  await writeAdr(root, { id: '002', title: 'Parked thing', status: 'Accepted' });
  await writeAdr(root, {
    id: '003',
    title: 'Phased thing',
    status: 'Accepted',
    impl: { stage: 'phased', refs: ['#42'] },
    implementedBy: ['package.json'],
  });
  await writeAdr(root, { id: '004', title: 'Idea', status: 'Proposed' });
}

describe('adrStatusCommand', () => {
  let root: string;
  let log: jest.SpyInstance;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'adr-status-'));
    await writeRegister(root);
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    log.mockRestore();
    await fs.remove(root);
  });

  const output = (): string => log.mock.calls.map((c) => String(c[0] ?? '')).join('\n');

  it('counts every status in the register', async () => {
    const result = await adrStatusCommand({ root });
    expect(result.total).toBe(4);
    expect(result.counts).toEqual({ Implemented: 1, Accepted: 2, Proposed: 1 });
  });

  it('treats ratified-but-unfinished as outstanding, and finished work as not', async () => {
    const result = await adrStatusCommand({ root });
    expect(result.outstanding.map((e) => e.id)).toEqual([2, 3]);
  });

  describe('status filter', () => {
    it('matches case-insensitively', async () => {
      const lower = await adrStatusCommand({ root, status: 'implemented' });
      const exact = await adrStatusCommand({ root, status: 'Implemented' });
      expect(lower.entries.length).toBe(exact.entries.length);
      expect(output()).toContain('Done thing');
    });

    it('rejects a status outside the vocabulary with a typed error naming the options', async () => {
      await expect(adrStatusCommand({ root, status: 'Bogus' })).rejects.toThrow(ValidationError);
      await expect(adrStatusCommand({ root, status: 'Bogus' })).rejects.toThrow(/Proposed/);
    });

    it('says no ADRs have that status — not "nothing outstanding"', async () => {
      await adrStatusCommand({ root, status: 'Superseded' });
      expect(output()).toContain('No ADRs with status Superseded');
      expect(output()).not.toContain('nothing outstanding');
    });

    it('keeps the register summary visible on a filtered run', async () => {
      await adrStatusCommand({ root, status: 'Superseded' });
      expect(output()).toContain('4 ADRs');
    });
  });

  describe('--outstanding', () => {
    it('still says "nothing outstanding" when there genuinely is none', async () => {
      const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'adr-empty-'));
      await writeAdr(empty, {
        id: '001',
        title: 'Done',
        status: 'Implemented',
        implementedBy: ['package.json'],
      });
      await adrStatusCommand({ root: empty, outstandingOnly: true });
      expect(output()).toContain('nothing outstanding');
      await fs.remove(empty);
    });
  });

  describe('root resolution', () => {
    it('finds the register from a nested subdirectory', async () => {
      const nested = path.join(root, 'packages', 'deep', 'src');
      await fs.ensureDir(nested);
      const cwd = jest.spyOn(process, 'cwd').mockReturnValue(nested);
      try {
        const result = await adrStatusCommand({});
        expect(result.total).toBe(4);
      } finally {
        cwd.mockRestore();
      }
    });

    it('throws a typed error when no register exists in cwd or any parent', async () => {
      const bare = await fs.mkdtemp(path.join(os.tmpdir(), 'adr-none-'));
      const cwd = jest.spyOn(process, 'cwd').mockReturnValue(bare);
      try {
        await expect(adrStatusCommand({})).rejects.toThrow(ValidationError);
      } finally {
        cwd.mockRestore();
        await fs.remove(bare);
      }
    });
  });
});
