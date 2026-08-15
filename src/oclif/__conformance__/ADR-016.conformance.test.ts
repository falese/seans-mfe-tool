/**
 * ADR-016 conformance — the BaseCommand pattern, checked by construction.
 *
 * ADR-016's rules: every command extends `BaseCommand`; commands implement
 * `runCommand()` not `run()`; `--json` is declared once on BaseCommand and
 * inherited; `--dry-run` is "declared as a shared flag for mutating commands".
 *
 * None of that was verified. `__tests__/command-conformance.test.ts` looks like
 * the gate but sweeps the tree for **MCP schema coverage** (ADR-019/077), not
 * for these rules — its own docstring is about schemas. `BaseCommand.test.ts`
 * checks the shim re-export and `--json` on a hand-built subclass, never on a
 * real command. So a command could extend oclif's `Command` directly, or
 * override `run()` and bypass the envelope entirely, and land green.
 *
 * Scope, stated so this does not read as broader than it is: these checks are
 * **structural**. A command can satisfy every one of them and still misuse the
 * base class. The behavioural half — that the envelope is actually emitted, on
 * stdout, exactly once — lives in `__tests__/json-contract.test.ts` and
 * `__tests__/output-schema-conformance.test.ts`.
 *
 * Each check has been proven able to fail: point a command at oclif's `Command`
 * (1), rename a `runCommand` to `run` (2), redeclare `json` locally (3), restore
 * a hand-rolled `--dry-run` (4).
 *
 * Refs #252
 */
import * as fs from 'fs';
import { BaseCommand } from '@falese/smt-oclif-base';
import { loadShippedCommands } from '../command-discovery';
import type { LoadedCommand } from '../command-discovery';

// The set the binary ships, not the set under `src/`. Scoped to `src/commands`
// this sweep could not see the four `bff:*` commands `oclif.plugins` ships, and
// two of them had kept the hand-rolled `--dry-run` with `char: 'd'` that the
// last check in this file exists to forbid — while `api -d` is `--database`.
const commands: LoadedCommand[] = loadShippedCommands();

/** The class body as written, for the rules that are about source shape. */
const sourceOf = (c: LoadedCommand): string => fs.readFileSync(c.absPath, 'utf8');

describe('ADR-016: the BaseCommand pattern', () => {
  it('discovers the command tree (a sweep over nothing proves nothing)', () => {
    expect(commands.length).toBeGreaterThan(10);
  });

  it.each(commands.map((c) => [c.id, c] as const))(
    '%s extends BaseCommand',
    (_id, command) => {
      // Walk the prototype chain by name rather than importing BaseCommand and
      // using instanceof: commands reach it through the `@falese/smt-oclif-base`
      // shim, and an identity check would be asserting module resolution.
      const names: string[] = [];
      for (let p = Object.getPrototypeOf(command.cls); p; p = Object.getPrototypeOf(p)) {
        if (typeof p === 'function' && p.name) names.push(p.name);
      }
      expect(names).toContain('BaseCommand');
    }
  );

  it.each(commands.map((c) => [c.id, c] as const))(
    '%s implements runCommand() and does not override run()',
    (_id, command) => {
      // BaseCommand.run() is what serialises the CommandResult envelope and
      // turns a typed error into an exit code. A command that overrides it
      // silently opts out of the whole contract.
      expect(typeof command.cls.prototype.runCommand).toBe('function');
      expect(Object.prototype.hasOwnProperty.call(command.cls.prototype, 'run')).toBe(false);
    }
  );

  it.each(commands.map((c) => [c.id, c] as const))(
    '%s inherits --json from BaseCommand rather than redeclaring it',
    (_id, command) => {
      // Commands spread it in — `static flags = { ...BaseCommand.baseFlags, … }`
      // — so the flag being *present* on `flags` is correct and expected. What
      // must hold is that it is the same object: a command writing its own
      // `json: Flags.boolean({…})` would satisfy a presence check while quietly
      // drifting on default or description, which is the failure worth catching.
      expect(command.cls.flags?.json).toBeDefined();
      expect(command.cls.flags?.json).toBe(BaseCommand.baseFlags.json);
    }
  );

  it('declares --dry-run once, shared, rather than per command', () => {
    // ADR-016 says shared. It was not: six commands hand-rolled it, and the
    // copies had already drifted into `char: 'D'` on api/deploy versus `char:
    // 'd'` on the four remote:* commands — while `-d` on api is --database, a
    // flag that takes a value. So `-d` meant "preview, do not write" on four
    // mutating commands and "here comes a database name" on another.
    const handRolled = commands.filter((c) => /'dry-run':\s*Flags\.boolean/.test(sourceOf(c)));
    expect(handRolled.map((c) => c.id)).toEqual([]);
  });

  it('gives every command that has --dry-run the identical definition', () => {
    // The consequence of sharing it: one description, one (absent) short char.
    const withDryRun = commands.filter((c) => c.cls.flags?.['dry-run']);
    expect(withDryRun.length).toBeGreaterThan(0);

    const shapes = new Set(
      withDryRun.map((c) => JSON.stringify({ char: c.cls.flags!['dry-run'].char ?? null }))
    );
    expect(shapes.size).toBe(1);
  });

  it('never lets one short char mean dry-run on one command and something else on another', () => {
    // The actual hazard, stated directly rather than as a proxy for it.
    const dryRunChars = new Set<string>();
    const otherChars = new Set<string>();
    for (const command of commands) {
      for (const [name, flag] of Object.entries(command.cls.flags ?? {})) {
        if (!flag?.char) continue;
        (name === 'dry-run' ? dryRunChars : otherChars).add(flag.char);
      }
    }
    for (const char of dryRunChars) expect(otherChars.has(char)).toBe(false);
  });
});
