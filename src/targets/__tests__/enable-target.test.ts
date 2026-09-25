/**
 * Enabling a secondary target on a manifest (ADR-095) — `--swift` and
 * `--rust` on `remote:init` / `remote:generate`.
 *
 * One implementation for every target, so the flags cannot disagree about
 * what "enable" means: additive, idempotent, and textual when the file has no
 * `targets:` block yet, so a hand-commented manifest keeps its comments.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { withTarget, hasTarget, enableTargetInFile } from '../enable';
import { withRustTarget, enableRustTargetInFile } from '../rust';
import { withSwiftTarget } from '../swift';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'enable-target-'));
});
afterEach(async () => {
  await fs.remove(dir);
});

const MANIFEST = `# hand-written comment\nname: crew\nversion: 1.0.0\ntype: remote\n`;

describe('withTarget', () => {
  it('adds an empty block for the target and leaves the rest alone', () => {
    const next = withTarget({ targets: undefined }, 'rust');
    expect(next.targets).toEqual({ rust: {} });
  });

  it('is additive — an existing target survives', () => {
    const next = withTarget({ targets: { swift: {} } }, 'rust');
    expect(Object.keys(next.targets ?? {})).toEqual(['swift', 'rust']);
  });

  it('is idempotent — an existing block is not replaced', () => {
    const m = { targets: { rust: { crateName: 'keep' } } };
    expect(withTarget(m, 'rust')).toBe(m);
  });

  it('backs both named helpers', () => {
    expect(hasTarget(withRustTarget({}), 'rust')).toBe(true);
    expect(hasTarget(withSwiftTarget({}), 'swift')).toBe(true);
  });
});

describe('enableTargetInFile', () => {
  it('appends a commented block, preserving the file byte for byte above it', async () => {
    const file = path.join(dir, 'mfe-manifest.yaml');
    await fs.writeFile(file, MANIFEST);
    expect(await enableRustTargetInFile(file)).toBe(true);
    const raw = await fs.readFile(file, 'utf8');
    expect(raw.startsWith(MANIFEST)).toBe(true);
    expect(raw).toContain('Cargo crate under rust/');
    expect((yaml.load(raw) as { targets: unknown }).targets).toEqual({ rust: {} });
  });

  it('adds to an existing targets: block', async () => {
    const file = path.join(dir, 'mfe-manifest.yaml');
    await fs.writeFile(file, `${MANIFEST}targets:\n  swift: {}\n`);
    expect(await enableTargetInFile(file, 'rust', [])).toBe(true);
    expect((yaml.load(await fs.readFile(file, 'utf8')) as { targets: unknown }).targets).toEqual({
      swift: {},
      rust: {},
    });
  });

  it('does nothing when the target is already declared', async () => {
    const file = path.join(dir, 'mfe-manifest.yaml');
    await fs.writeFile(file, `${MANIFEST}targets:\n  rust:\n    crateName: keep\n`);
    const before = await fs.readFile(file, 'utf8');
    expect(await enableRustTargetInFile(file)).toBe(false);
    expect(await fs.readFile(file, 'utf8')).toBe(before);
  });

  it('fails with a typed error when the file cannot be read', async () => {
    await expect(enableRustTargetInFile(path.join(dir, 'missing.yaml'))).rejects.toThrow(/Failed to read manifest/);
  });
});
