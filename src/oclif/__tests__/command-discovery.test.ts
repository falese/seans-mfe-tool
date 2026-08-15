/**
 * Discovery has to reach every command the binary ships, not every command in
 * `src/`.
 *
 * The ADR-016 sweep enumerated `src/commands` only, so the four `bff:*` commands
 * — shipped in the same binary through `oclif.plugins` — were outside every
 * check it makes. Two of them had hand-rolled `--dry-run` with `char: 'd'` while
 * `api -d` is `--database`, which is the exact collision the sweep reports on.
 *
 * Refs #252 · ADR-016
 */
import * as path from 'path';
import { loadCommands, loadShippedCommands, pluginCommandDirs } from '../command-discovery';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('pluginCommandDirs', () => {
  it('resolves the workspace plugins the CLI declares in oclif.plugins', () => {
    // Derived from the manifest rather than listed here: a new first-party
    // plugin joins the sweep by being shipped, not by someone remembering.
    expect(pluginCommandDirs()).toEqual([
      path.join(REPO_ROOT, 'packages', 'bff-plugin', 'src', 'commands'),
    ]);
  });

  it('ignores third-party plugins, which have no workspace source to sweep', () => {
    // `@oclif/plugin-help` and `@oclif/plugin-plugins` are also in the list.
    for (const dir of pluginCommandDirs()) {
      expect(dir.startsWith(path.join(REPO_ROOT, 'packages'))).toBe(true);
    }
  });
});

describe('loadShippedCommands', () => {
  it('includes plugin commands alongside the root tree', () => {
    const ids = loadShippedCommands().map((c) => c.id);
    expect(ids).toContain('deploy');
    expect(ids).toEqual(
      expect.arrayContaining(['bff:init', 'bff:build', 'bff:dev', 'bff:validate'])
    );
  });

  it('is strictly larger than the root tree', () => {
    expect(loadShippedCommands().length).toBeGreaterThan(loadCommands().length);
  });

  it('loads a real class for every entry', () => {
    for (const command of loadShippedCommands()) {
      expect(typeof (command.cls as unknown)).toBe('function');
      expect(path.isAbsolute(command.absPath)).toBe(true);
    }
  });
});
