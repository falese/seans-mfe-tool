/**
 * Registry-driven conformance sweep over EVERY command.
 *
 * The existing contract tests each cover a hand-picked sample, so a new command
 * can join the CLI without --json, without a typed exit path, and without an
 * MCP schema, and nothing goes red. This sweep enumerates the command tree
 * instead, so the contract is checked by construction rather than by whoever
 * remembered to add a case.
 *
 * It also covers the MCP tool catalog: schemas/ is what mcp:serve turns into
 * agent-callable tools, and a command with no schema is invisible to agents.
 * That catalog is now generated from the oclif registry
 * (scripts/generate-schemas.ts + src/oclif/schema-derivation.ts), so the
 * exclusion list is imported rather than restated here — two copies of the
 * policy is the drift this whole file exists to prevent.
 *
 * Refs #139 · ADR-016 · ADR-018 · ADR-019 · ADR-077
 */

import * as fs from 'fs';
import * as path from 'path';
import { CATALOG_EXCLUDED } from '../schema-derivation';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'src', 'commands');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');

/** Single source of truth — see src/oclif/schema-derivation.ts. */
const SCHEMA_EXEMPT: Record<string, string> = CATALOG_EXCLUDED;

/** Files under src/commands that are not commands. */
function isCommandFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (!base.endsWith('.ts') || base.endsWith('.d.ts')) return false;
  if (base.includes('.test.') || base.startsWith('_')) return false;
  if (relPath.includes('__tests__')) return false;
  // A6/A7 migration shims: flat files that re-export a nested command.
  return !['remote-init.ts', 'remote-generate.ts', 'remote-init-angular.ts'].includes(base);
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
    '%s has an MCP schema',
    (id, _cmd) => {
      expect(fs.existsSync(schemaPathFor(id))).toBe(true);
    },
  );

  it('every exemption names a command that actually exists', () => {
    const ids = new Set(commands.map((c) => c.id));
    for (const exempt of Object.keys(SCHEMA_EXEMPT)) {
      expect(ids).toContain(exempt);
    }
  });

  it('no command is uncovered — a new command without a schema fails here', () => {
    const uncovered = commands
      .filter((c) => !(c.id in SCHEMA_EXEMPT) && !fs.existsSync(schemaPathFor(c.id)))
      .map((c) => c.id)
      .sort();

    expect(uncovered).toEqual([]);
  });

  it('the build surface is reachable by agents over MCP', () => {
    // The gap this replaced: no mfe:build:* tool existed, so an agent could
    // scaffold and validate an MFE but never build the thing it had made.
    for (const id of ['build:check', 'build:dev', 'build:docker', 'build:prod']) {
      expect(fs.existsSync(schemaPathFor(id))).toBe(true);
    }
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

  it('x-positional matches the command\'s declared args, in order', () => {
    // buildArgv places these positionally. When this was a hardcoded guess it
    // included `spec`, which is a flag — so `mfe:api` produced a second
    // positional that a strict command rejects.
    for (const file of schemaFiles) {
      const id = path.basename(file, '.json').replace(/-/g, ':');
      const cmd = commands.find((c) => c.id === id);
      if (!cmd) continue;

      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
      expect({ schema: file, positional: schema.input['x-positional'] }).toEqual({
        schema: file,
        positional: Object.keys(cmd.cls.args ?? {}),
      });
    }
  });

  it('every output schema is closed and complete', () => {
    // Derived from the declared result type, so it enumerates every field the
    // command can return. Closing the object is what makes a future undeclared
    // field fail the drift gate instead of silently breaking validating
    // clients — which is how `remote:generate.preserved` and the two
    // `bff:validate` fields went missing for months.
    for (const file of schemaFiles) {
      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
      const output = schema.output;
      // A result type with no enumerable members degrades to an open object
      // rather than a confident wrong shape; those legitimately stay open.
      if (!output.properties) {
        expect({ schema: file, output }).toEqual({ schema: file, output: { type: 'object' } });
        continue;
      }
      expect({ schema: file, closed: output.additionalProperties }).toEqual({
        schema: file,
        closed: false,
      });
    }
  });

  it('no schema exposes a transport-owned flag', () => {
    // --json is appended to every child call and the envelope depends on it;
    // MCP is non-interactive by construction; `cwd` is injected as the reserved
    // execution argument (#279). A caller setting any of them breaks the call.
    for (const file of schemaFiles) {
      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
      const declared = Object.keys(schema.input?.properties ?? {});
      for (const owned of ['json', 'interactive', 'cwd']) {
        expect({ schema: file, exposes: owned, present: declared.includes(owned) }).toEqual({
          schema: file,
          exposes: owned,
          present: false,
        });
      }
    }
  });
});
