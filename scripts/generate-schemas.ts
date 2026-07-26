#!/usr/bin/env ts-node
/**
 * Generates JSON Schema documents for every seans-mfe-tool command.
 *
 * Nothing here is hand-written. Both halves of every contract are derived:
 *
 *   inputs   the live oclif registry (`Config.load()`, first-party plugins
 *            included) — the command's own flag and arg declarations
 *   outputs  the command's declared result type, resolved through the
 *            TypeScript compiler (the `T` in `extends BaseCommand<T>`)
 *
 * That is the point. This file used to carry both as literals and they drifted
 * every way a literal can: `build:*` had no entry at all, so agents could
 * scaffold an MFE over MCP but never build one; `deploy` advertised eight flags
 * the command does not have; `remote:init` omitted `framework`, so no agent
 * could scaffold Angular over MCP; and on the output side `remote:generate`
 * and `bff:validate` both omitted fields they genuinely return, against schemas
 * declared `additionalProperties: false` — so a validating agent rejected every
 * response from either.
 *
 * The chain is now closed end to end. TypeScript already enforces that a
 * command returns its declared `T`; deriving the schema from that same `T`
 * means implementation, type, and published contract cannot disagree, with no
 * runtime validation anywhere.
 *
 * Output: schemas/<command-name>.json  (one per command, topic:sub uses topic-sub)
 *
 * Usage:
 *   npm run build:schemas             # generate + write
 *   npm run build:schemas -- --check  # generate + diff (fails if stale)
 *
 * Refs #104 (B5) · #139 · ADR-019 · ADR-077
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Config } from '@oclif/core';
import { EXIT_CODES as EXIT_CODE_MAP } from '@seans-mfe/contracts';
import {
  deriveInputSchema,
  selectCatalogCommands,
  CATALOG_EXCLUDED,
  type RegistryCommand,
} from '../src/oclif/schema-derivation';
import { typeToJsonSchema, resolveCommandResultType } from '../src/oclif/type-to-schema';

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');
const CHECK_MODE = process.argv.includes('--check');

// Sorted so the emitted array is stable; sourced from the contracts table
// rather than restated, so adding an exit code cannot leave schemas stale.
const EXIT_CODES = [...new Set(Object.values(EXIT_CODE_MAP))].sort((a, b) => a - b);


// ---------------------------------------------------------------------------
// Build and write
// ---------------------------------------------------------------------------

function schemaFilename(commandName: string): string {
  return commandName.replace(/:/g, '-') + '.json';
}

/**
 * Where a command's source lives, by convention from its id and owning plugin.
 * `remote:generate:capability` -> src/commands/remote/generate/capability.ts
 */
function sourceFileFor(command: RegistryCommand): string | undefined {
  const rel = command.id.split(':').join('/') + '.ts';
  const roots = command.pluginName === '@falese/bff-plugin'
    ? [path.join(REPO_ROOT, 'packages/bff-plugin/src/commands')]
    : [path.join(REPO_ROOT, 'src/commands')];

  for (const root of roots) {
    const file = path.join(root, rel);
    if (fs.existsSync(file)) return file;
  }
  return undefined;
}

/**
 * Output schemas derived from each command's declared result type.
 *
 * TypeScript already enforces that a command returns the `T` in
 * `BaseCommand<T>`; deriving the schema from that same `T` closes the chain
 * from implementation to published contract. Before this, the schema was
 * hand-typed and drifted — `RemoteGenerateResult.preserved` was missing from a
 * schema declared `additionalProperties: false`, so a validating agent
 * rejected every `remote:generate` response.
 */
function deriveOutputSchemas(commands: RegistryCommand[]): Map<string, object> {
  const files = new Map<string, string>();
  for (const command of commands) {
    const file = sourceFileFor(command);
    if (file) files.set(command.id, file);
  }

  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, ts.sys.readFile).config,
    ts.sys,
    REPO_ROOT,
  );
  const program = ts.createProgram([...files.values()], {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
    // The repo compiles with `strict: false`, which collapses `string | null`
    // to `string` — so a schema read under the repo's own settings claimed
    // `EnvCheckResult.found` was always a string while `build:check` really
    // returns null for a missing tool. Read the types as they were AUTHORED:
    // `| null` was written deliberately and is what the command does.
    strictNullChecks: true,
  });
  const checker = program.getTypeChecker();

  const schemas = new Map<string, object>();
  for (const [id, file] of files) {
    const type = resolveCommandResultType(file, program);
    if (type) schemas.set(id, typeToJsonSchema(type, checker));
  }
  return schemas;
}

function buildSchema(command: RegistryCommand, output: object | undefined): object {
  if (!output) {
    throw new Error(
      `No output schema for "${command.id}".\n\n` +
      `It is derived from the command's declared result type — the T in\n` +
      `\`extends BaseCommand<T>\`. This usually means the command's source file was\n` +
      `not found by convention, or it declares no type argument.\n\n` +
      `Either give the command a typed result, or, if it should not be an\n` +
      `agent-facing tool, add it to CATALOG_EXCLUDED in\n` +
      `src/oclif/schema-derivation.ts with a reason.`,
    );
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://seans-mfe.dev/schemas/${command.id}.json`,
    title: command.id,
    description: command.description ?? `Input/output contract for seans-mfe-tool ${command.id}`,
    input:      deriveInputSchema(command),
    output,
    errorCodes: EXIT_CODES,
  };
}

/**
 * The live oclif registry, including first-party plugins. Config.load() is the
 * same resolution the CLI itself does at startup, so the catalog cannot
 * describe a command set the CLI does not actually have.
 */
async function loadRegistry(): Promise<RegistryCommand[]> {
  const config = await Config.load(REPO_ROOT);
  return config.commands as unknown as RegistryCommand[];
}

async function main(): Promise<void> {
  if (!fs.existsSync(SCHEMAS_DIR)) {
    fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
  }

  const commands = selectCatalogCommands(await loadRegistry());
  const outputs = deriveOutputSchemas(commands);
  const expected = new Set(commands.map((c) => schemaFilename(c.id)));
  let drifted = false;

  for (const command of commands) {
    const json = JSON.stringify(buildSchema(command, outputs.get(command.id)), null, 2) + '\n';
    const file = path.join(SCHEMAS_DIR, schemaFilename(command.id));

    if (CHECK_MODE) {
      if (!fs.existsSync(file)) {
        console.error(`MISSING: ${file}`);
        drifted = true;
        continue;
      }
      if (fs.readFileSync(file, 'utf8') !== json) {
        console.error(`STALE: ${file}`);
        drifted = true;
      } else {
        console.log(`OK: ${path.relative(process.cwd(), file)}`);
      }
    } else {
      fs.writeFileSync(file, json);
      console.log(`wrote: ${path.relative(process.cwd(), file)}`);
    }
  }

  // A schema whose command no longer exists would keep advertising a tool that
  // cannot run — the same failure mode as the phantom mfe:manifest.schema tool,
  // arrived at from the other direction.
  const orphans = fs
    .readdirSync(SCHEMAS_DIR)
    .filter((f) => f.endsWith('.json') && !expected.has(f));

  for (const orphan of orphans) {
    if (CHECK_MODE) {
      console.error(`ORPHAN: ${orphan} — no such command in the registry`);
      drifted = true;
    } else {
      fs.unlinkSync(path.join(SCHEMAS_DIR, orphan));
      console.log(`removed: schemas/${orphan} (no such command)`);
    }
  }

  if (CHECK_MODE && drifted) {
    console.error('\nSchema drift detected. Run: npm run build:schemas');
    process.exit(1);
  }

  if (!CHECK_MODE) {
    console.log(`\n${commands.length} schema(s) generated in schemas/`);
    const excluded = Object.keys(CATALOG_EXCLUDED);
    if (excluded.length) {
      console.log(`${excluded.length} command(s) excluded by policy: ${excluded.join(', ')}`);
    }
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
