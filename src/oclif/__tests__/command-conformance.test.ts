/**
 * Registry-driven conformance sweep over EVERY command.
 *
 * The existing contract tests each cover a hand-picked sample, so a new command
 * can join the CLI without --json, without a typed exit path, and without an
 * MCP schema, and nothing goes red. This sweep enumerates the command tree
 * instead, so the contract is checked by construction rather than by whoever
 * remembered to add a case.
 *
 * It also pins the MCP tool-catalog gap: schemas/ is what mcp:serve turns into
 * agent-callable tools, and a command with no schema is silently invisible to
 * agents. Commands legitimately outside that surface are listed in
 * SCHEMA_EXEMPT with a reason; everything else must have a schema.
 *
 * Refs #139 · ADR-016 · ADR-018 · ADR-019 · ADR-077
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'src', 'commands');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');

/**
 * Commands that intentionally have no MCP schema.
 *
 * `build:*` is NOT in this list on purpose — those four are a real gap (an
 * agent can scaffold and validate an MFE over MCP but cannot build it) and are
 * covered by the expected-failure test at the bottom of this file, so the gap
 * stays visible instead of being quietly exempted.
 */
const SCHEMA_EXEMPT: Record<string, string> = {
  'mcp:serve': 'the MCP server itself — exposing it as one of its own tools would be recursive',
  schemas: 'lists the tool catalog; agents get the same information from MCP tools/list',
  'remote:init-angular': 'deprecated alias for `remote:init --framework angular`',
};

/** Files under src/commands that are not commands. */
function isCommandFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (!base.endsWith('.ts') || base.endsWith('.d.ts')) return false;
  if (base.includes('.test.') || base.startsWith('_')) return false;
  if (relPath.includes('__tests__')) return false;
  // A6/A7 migration shims: flat files that re-export a nested command.
  return !['remote-init.ts', 'remote-generate.ts', 'remote-init-angular.ts', 'create-api.ts'].includes(base);
}

function walk(dir: string, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walk(path.join(dir, entry.name), rel);
    return isCommandFile(rel) ? [rel] : [];
  });
}

/** src/commands/remote/generate/capability.ts → remote:generate:capability */
function toCommandId(relPath: string): string {
  return relPath.replace(/\.ts$/, '').split('/').join(':');
}

/** remote:generate:capability → schemas/remote-generate-capability.json */
function schemaPathFor(commandId: string): string {
  return path.join(SCHEMAS_DIR, `${commandId.replace(/:/g, '-')}.json`);
}

/** The parts of an oclif command class this sweep probes. */
interface CommandClass {
  prototype: Record<string, unknown>;
  baseFlags?: Record<string, { allowNo?: boolean }>;
  flags?: Record<string, { allowNo?: boolean }>;
  args?: Record<string, unknown>;
}

interface LoadedCommand {
  id: string;
  relPath: string;
  cls: CommandClass;
}

const commands: LoadedCommand[] = walk(COMMANDS_DIR)
  .sort()
  .map((relPath) => {
    const mod = require(path.join(COMMANDS_DIR, relPath)) as { default?: unknown };
    return { id: toCommandId(relPath), relPath, cls: mod.default as CommandClass };
  })
  .filter((c) => typeof c.cls === 'function');

describe('command registry sweep', () => {
  it('discovers the command tree', () => {
    expect(commands.length).toBeGreaterThanOrEqual(16);
  });

  it.each(commands.map((c) => [c.id, c] as const))(
    '%s extends BaseCommand and implements runCommand',
    (_id, cmd) => {
      expect(typeof cmd.cls.prototype.runCommand).toBe('function');
      // BaseCommand owns run(); a command that overrides it escapes the envelope.
      expect(Object.prototype.hasOwnProperty.call(cmd.cls.prototype, 'run')).toBe(false);
    },
  );

  it.each(commands.map((c) => [c.id, c] as const))(
    '%s inherits the agent-profile flags',
    (_id, cmd) => {
      const flags = { ...cmd.cls.baseFlags, ...cmd.cls.flags };
      expect(Object.keys(flags)).toContain('json');
      expect(Object.keys(flags)).toContain('interactive');
      expect(flags.interactive.allowNo).toBe(true);
    },
  );
});

describe('MCP schema coverage', () => {
  const covered = commands.filter((c) => !(c.id in SCHEMA_EXEMPT));

  it.each(covered.map((c) => [c.id, c] as const))(
    '%s has an MCP schema, or a documented exemption',
    (id, _cmd) => {
      const schemaPath = schemaPathFor(id);
      const exists = fs.existsSync(schemaPath);

      if (!exists) {
        // Known gap: the build surface is invisible to agents over MCP.
        // Tracked as part of the re-scoped #139 (agent contract completion).
        expect(id).toMatch(/^build:/);
        return;
      }
      expect(exists).toBe(true);
    },
  );

  it('every exemption names a command that actually exists', () => {
    const ids = new Set(commands.map((c) => c.id));
    for (const exempt of Object.keys(SCHEMA_EXEMPT)) {
      expect(ids).toContain(exempt);
    }
  });

  it('the build surface is the only uncovered group (pin the known gap)', () => {
    const uncovered = commands
      .filter((c) => !(c.id in SCHEMA_EXEMPT) && !fs.existsSync(schemaPathFor(c.id)))
      .map((c) => c.id)
      .sort();

    // If this list shrinks, the gap is being closed — update the expectation.
    // If it GROWS, a new command shipped without an MCP schema.
    expect(uncovered).toEqual(['build:check', 'build:dev', 'build:docker', 'build:prod']);
  });
});

describe('schema catalog', () => {
  const schemaFiles = fs
    .readdirSync(SCHEMAS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  it('every schema declares the full command contract', () => {
    for (const file of schemaFiles) {
      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
      expect(schema).toHaveProperty('title');
      expect(schema).toHaveProperty('input');
      expect(schema).toHaveProperty('output');
      expect(schema).toHaveProperty('errorCodes');
    }
  });

  it('every schema flag exists on the command it describes', () => {
    for (const file of schemaFiles) {
      const id = path.basename(file, '.json').replace(/-/g, ':');
      const cmd = commands.find((c) => c.id === id);
      if (!cmd) continue; // plugin-owned schema (bff:*) — not in this repo's command tree

      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
      const declared = Object.keys(schema.input?.properties ?? {});
      const actual = new Set([
        ...Object.keys({ ...cmd.cls.baseFlags, ...cmd.cls.flags }),
        ...Object.keys(cmd.cls.args ?? {}),
        'cwd', // reserved MCP argument, injected by the tool registry (#279)
      ]);

      for (const prop of declared) {
        expect({ schema: file, flag: prop, known: actual.has(prop) }).toEqual({
          schema: file,
          flag: prop,
          known: true,
        });
      }
    }
  });
});
