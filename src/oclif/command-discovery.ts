/**
 * Enumerate the oclif command tree.
 *
 * Extracted from `__tests__/command-conformance.test.ts`, which needed it to
 * sweep MCP schema coverage, so that the ADR-016 conformance pack can enumerate
 * the same set without restating the policy. Two copies of "what counts as a
 * command" is the drift both of those checks exist to prevent.
 *
 * Discovery is by file, not by oclif's own registry, on purpose: the point of a
 * sweep is to catch a command that landed without being wired up correctly, and
 * asking the registry would only return the ones already wired.
 *
 * `src/commands` is not the whole binary, though — `oclif.plugins` ships the
 * `bff:*` commands from a workspace package, and a sweep scoped to this tree
 * cannot see them. `loadShippedCommands()` is the set a user actually gets.
 */
import * as fs from 'fs';
import * as path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const COMMANDS_DIR = path.resolve(__dirname, '..', 'commands');

/**
 * Files under `src/commands` that are not commands.
 *
 * The named exclusions are the A6/A7 migration shims — flat files that
 * re-export a nested command, so counting them would double-count.
 */
export function isCommandFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (!base.endsWith('.ts') || base.endsWith('.d.ts')) return false;
  if (base.includes('.test.') || base.startsWith('_')) return false;
  if (relPath.includes('__tests__')) return false;
  return !['remote-init.ts', 'remote-generate.ts', 'remote-init-angular.ts', 'create-api.ts'].includes(
    base
  );
}

/** Every command file under `dir`, as paths relative to it. */
export function walkCommands(dir: string = COMMANDS_DIR, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walkCommands(path.join(dir, entry.name), rel);
    return isCommandFile(rel) ? [rel] : [];
  });
}

/** `remote/generate/capability.ts` → `remote:generate:capability` */
export function toCommandId(relPath: string): string {
  return relPath.replace(/\.ts$/, '').split('/').join(':');
}

/**
 * The command roots of the first-party plugins this CLI ships.
 *
 * Read from `oclif.plugins` so the set follows what is shipped rather than a
 * second list to keep in step. Third-party plugins (`@oclif/plugin-help`) have
 * no workspace source and are dropped: these sweeps read our own code, and a
 * dependency's conformance is not ours to assert.
 */
export function pluginCommandDirs(repoRoot: string = REPO_ROOT): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    oclif?: { plugins?: string[] };
  };
  const declared = new Set(manifest.oclif?.plugins ?? []);
  if (declared.size === 0) return [];

  const packagesDir = path.join(repoRoot, 'packages');
  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesDir, entry.name))
    .filter((dir) => {
      const pkgPath = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgPath)) return false;
      const { name } = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
      return name !== undefined && declared.has(name);
    })
    .map((dir) => path.join(dir, 'src', 'commands'))
    .filter((dir) => fs.existsSync(dir))
    .sort();
}

/** The parts of an oclif command class these sweeps probe. */
export interface CommandClass {
  prototype: Record<string, unknown>;
  baseFlags?: Record<string, { allowNo?: boolean; char?: string }>;
  flags?: Record<string, { allowNo?: boolean; char?: string }>;
  args?: Record<string, unknown>;
}

export interface LoadedCommand {
  id: string;
  relPath: string;
  /** Absolute path, for checks that read the source rather than the class. */
  absPath: string;
  cls: CommandClass;
}

/**
 * Load every command class under one root. Files whose default export is not a
 * class are dropped rather than failing here — `isCommandFile` is a filename
 * heuristic, and a sweep that crashes on the first odd file reports nothing at
 * all.
 */
export function loadCommands(dir: string = COMMANDS_DIR): LoadedCommand[] {
  return walkCommands(dir)
    .sort()
    .map((relPath) => {
      const absPath = path.join(dir, relPath);
      const mod = require(absPath) as { default?: unknown };
      return { id: toCommandId(relPath), relPath, absPath, cls: mod.default as CommandClass };
    })
    .filter((c) => typeof (c.cls as unknown) === 'function');
}

/**
 * Every command the binary ships: the root tree plus each first-party plugin's.
 *
 * The set the ADR-016 sweep has to use. `loadCommands()` stays as it was for
 * the MCP catalog sweep, whose subject is `schemas/` — generated from this
 * repo's own registry, so plugin commands are genuinely out of its scope.
 */
export function loadShippedCommands(): LoadedCommand[] {
  return [COMMANDS_DIR, ...pluginCommandDirs()].flatMap((dir) => loadCommands(dir));
}
