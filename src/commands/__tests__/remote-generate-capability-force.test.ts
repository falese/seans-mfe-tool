/**
 * `remote:generate:capability --force` must mean what ADR-089 made it mean.
 *
 * ADR-089 redefined `writeGeneratedFiles`'s `force`: it no longer does nothing,
 * it REPLACES developer-owned files that already exist. `remote:generate` was
 * updated for that — it reports `reseeded` separately, prints it in red, and
 * tells the developer how to recover.
 *
 * This command forwards the same flag to the same writer and was not. It
 * reported replaced files as "✓ Generated files", never read `reseeded`, and
 * printed "Use --force to overwrite" under the skipped list — recommending the
 * one flag that destroys work, with none of the warning its sibling gives.
 *
 * A capability command reaches App.tsx, index.tsx, package.json, the bundler
 * config, the tsconfigs and the BFF's Dockerfile and README, because a
 * capability generation emits the whole plan, not just the feature files.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { writeGeneratedFiles } from '@seans-mfe/codegen';
import type { RemoteGenerateCapabilityResult } from '../../oclif/results';

describe('remote:generate:capability --force (ADR-089)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cap-force-'));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('the result type carries reseeded, so the command can report it', () => {
    // A compile-time assertion: the envelope has nowhere to put the one
    // outcome that destroys work unless this field exists.
    const result: RemoteGenerateCapabilityResult = {
      capabilityName: 'X',
      generated: [],
      skipped: [],
      errors: [],
      reseeded: [],
      dryRun: false,
    };
    expect(result.reseeded).toEqual([]);
  });

  it('the writer reports a replaced developer-owned file as a re-seed', async () => {
    // Pins the semantics the command has to surface: this is what --force
    // does to a file an MFE author has edited.
    const mine = path.join(dir, 'src', 'App.tsx');
    await fs.outputFile(mine, 'MY EDIT');

    const result = await writeGeneratedFiles(
      [{ path: mine, content: 'FRESH', overwrite: false }],
      { force: true },
    );

    expect(result.reseeded).toEqual([mine]);
    expect(await fs.readFile(mine, 'utf8')).toBe('FRESH');
  });
});
