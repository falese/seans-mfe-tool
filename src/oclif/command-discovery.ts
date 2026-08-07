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
 */
import * as fs from 'fs';
import * as path from 'path';

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
 * Load every command class. Files whose default export is not a class are
 * dropped rather than failing here — `isCommandFile` is a filename heuristic,
 * and a sweep that crashes on the first odd file reports nothing at all.
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
