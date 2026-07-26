#!/usr/bin/env ts-node
/**
 * Generates JSON Schema documents for every seans-mfe-tool command.
 *
 * The command list and every input schema are DERIVED from the live oclif
 * registry (`Config.load()`, which includes first-party plugins), not from a
 * hand-written list. That is the point: this file used to carry the command
 * roster as a literal, and it drifted in both directions — `build:*` had no
 * entry at all, so agents could scaffold an MFE over MCP but never build one,
 * and `deploy` advertised eight flags the command does not have.
 *
 * Output schemas remain hand-authored below, because a command's TypeScript
 * result type is not introspectable at runtime. A command with no output
 * schema is a hard failure rather than an empty `{}` — adding a command forces
 * the decision instead of silently producing a useless tool.
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
import { Config } from '@oclif/core';
import { EXIT_CODES as EXIT_CODE_MAP } from '@seans-mfe/contracts';
import {
  deriveInputSchema,
  selectCatalogCommands,
  CATALOG_EXCLUDED,
  type RegistryCommand,
} from '../src/oclif/schema-derivation';

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');
const CHECK_MODE = process.argv.includes('--check');

// Sorted so the emitted array is stable; sourced from the contracts table
// rather than restated, so adding an exit code cannot leave schemas stale.
const EXIT_CODES = [...new Set(Object.values(EXIT_CODE_MAP))].sort((a, b) => a - b);

// ---------------------------------------------------------------------------
// Result schemas (JSON Schema for each command's data field)
// ---------------------------------------------------------------------------

const MUTATING_RESULT_PROPS = {
  dryRun: { type: 'boolean' },
  plannedChanges: {
    type: 'array',
    items: {
      type: 'object',
      required: ['op', 'target'],
      properties: {
        op:     { type: 'string', enum: ['create', 'overwrite', 'skip', 'spawn'] },
        target: { type: 'string' },
        detail: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

const OUTPUT_SCHEMAS: Record<string, object> = {
  deploy: {
    type: 'object',
    required: ['appName', 'environment', 'ports', 'generatedFiles', 'dryRun'],
    properties: {
      appName:        { type: 'string' },
      environment:    { type: 'string', enum: ['development', 'production'] },
      containerId:    { type: 'string' },
      ports:          { type: 'array', items: { type: 'number' } },
      generatedFiles: { type: 'array', items: { type: 'string' } },
      mode:           { type: 'string' },
      ...MUTATING_RESULT_PROPS,
    },
    additionalProperties: false,
  },
  api: {
    type: 'object',
    required: ['name', 'database', 'port', 'generatedFiles', 'dryRun'],
    properties: {
      name:           { type: 'string' },
      database:       { type: 'string' },
      port:           { type: 'number' },
      generatedFiles: { type: 'array', items: { type: 'string' } },
      ...MUTATING_RESULT_PROPS,
    },
    additionalProperties: false,
  },
  'bff:init': {
    type: 'object',
    required: ['name', 'port', 'sources', 'generatedFiles', 'dryRun'],
    properties: {
      name:           { type: 'string' },
      port:           { type: 'number' },
      sources:        { type: 'array', items: { type: 'string' } },
      generatedFiles: { type: 'array', items: { type: 'string' } },
      ...MUTATING_RESULT_PROPS,
    },
    additionalProperties: false,
  },
  'bff:build': {
    type: 'object',
    required: ['meshConfigPath', 'generatedFiles', 'dryRun'],
    properties: {
      meshConfigPath: { type: 'string' },
      generatedFiles: { type: 'array', items: { type: 'string' } },
      ...MUTATING_RESULT_PROPS,
    },
    additionalProperties: false,
  },
  'bff:dev': {
    type: 'object',
    required: ['port', 'meshConfigPath'],
    properties: {
      port:           { type: 'number' },
      meshConfigPath: { type: 'string' },
    },
    additionalProperties: false,
  },
  'bff:validate': {
    type: 'object',
    required: ['valid', 'issues'],
    properties: {
      valid:  { type: 'boolean' },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['severity', 'message'],
          properties: {
            severity: { type: 'string', enum: ['error', 'warning'] },
            message:  { type: 'string' },
            path:     { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
  'remote:init': {
    type: 'object',
    required: ['name', 'port', 'targetDir', 'generatedFiles', 'dryRun'],
    properties: {
      name:           { type: 'string' },
      port:           { type: 'number' },
      targetDir:      { type: 'string' },
      generatedFiles: { type: 'array', items: { type: 'string' } },
      ...MUTATING_RESULT_PROPS,
    },
    additionalProperties: false,
  },
  'remote:generate': {
    type: 'object',
    required: ['generated', 'skipped', 'errors', 'preserved', 'dryRun'],
    properties: {
      generated: { type: 'array', items: { type: 'string' } },
      skipped:   { type: 'array', items: { type: 'string' } },
      errors:    { type: 'array', items: { type: 'string' } },
      // RemoteGenerateResult.preserved — capability names whose feature files
      // were kept because they are already implemented. Returned on both the
      // dry-run and real paths, but missing here, and the schema is
      // additionalProperties:false — so a schema-validating agent rejected
      // every remote:generate response, and could not see the one field that
      // tells it whether its own hand-written feature code survived.
      preserved: { type: 'array', items: { type: 'string' } },
      ...MUTATING_RESULT_PROPS,
    },
    additionalProperties: false,
  },
  'remote:generate:capability': {
    type: 'object',
    required: ['capabilityName', 'generated', 'skipped', 'errors', 'dryRun'],
    properties: {
      capabilityName: { type: 'string' },
      generated:      { type: 'array', items: { type: 'string' } },
      skipped:        { type: 'array', items: { type: 'string' } },
      errors:         { type: 'array', items: { type: 'string' } },
      ...MUTATING_RESULT_PROPS,
    },
    additionalProperties: false,
  },
  // #309's dependency/federation consistency rules, plus the slot rule wired
  // into the same command (ADR-073): one MFE-consistency surface, not two.
  'mfe:validate': {
    type: 'object',
    required: ['mfe', 'framework', 'ok', 'checked', 'issues'],
    properties: {
      mfe:       { type: 'string' },
      framework: { type: 'string' },
      ok:        { type: 'boolean' },
      checked:   { type: 'array', items: { type: 'string' } },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['rule', 'message'],
          properties: {
            rule:     { type: 'string' },
            message:  { type: 'string' },
            package:  { type: 'string' },
            expected: { type: 'string' },
            actual:   { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      typecheck: {
        type: 'object',
        required: ['ran', 'ok'],
        properties: {
          ran:    { type: 'boolean' },
          ok:     { type: 'boolean' },
          output: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
  'adr:status': {
    type: 'object',
    required: ['total', 'counts', 'outstanding', 'entries'],
    properties: {
      total:  { type: 'number' },
      counts: { type: 'object', additionalProperties: { type: 'number' } },
      outstanding: { type: 'array', items: { $ref: '#/definitions/adrStatusEntry' } },
      entries:     { type: 'array', items: { $ref: '#/definitions/adrStatusEntry' } },
    },
    definitions: {
      adrStatusEntry: {
        type: 'object',
        required: ['id', 'title', 'status', 'area', 'refs', 'implementedBy'],
        properties: {
          id:            { type: 'number' },
          title:         { type: 'string' },
          status:        { type: 'string' },
          area:          { type: 'string' },
          stage:         { type: 'string' },
          refs:          { type: 'array', items: { type: 'string' } },
          implementedBy: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
  'adr:validate': {
    type: 'object',
    required: ['adrs', 'ok', 'checked', 'issues'],
    properties: {
      adrs:    { type: 'number' },
      ok:      { type: 'boolean' },
      checked: { type: 'array', items: { type: 'string' } },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['rule', 'file', 'message'],
          properties: {
            rule:     { type: 'string' },
            file:     { type: 'string' },
            line:     { type: 'number' },
            message:  { type: 'string' },
            expected: { type: 'string' },
            actual:   { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
  'slots:validate': {
    type: 'object',
    required: ['providers', 'rulesFile', 'rulesChecked', 'findings', 'ok'],
    properties: {
      providers: {
        type: 'array',
        items: {
          type: 'object',
          required: ['mfe', 'slots'],
          properties: {
            mfe:   { type: 'string' },
            slots: { type: 'array', items: { type: 'string' } },
          },
          additionalProperties: false,
        },
      },
      rulesFile:    { type: 'string' },
      rulesChecked: { type: 'number' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['mfe', 'capability', 'slot', 'reason', 'fatal', 'message'],
          properties: {
            mfe:        { type: 'string' },
            capability: { type: 'string' },
            slot:       { type: 'string' },
            reason:     { type: 'string', enum: ['undeclared-slot', 'unknown-provider', 'malformed-address'] },
            fatal:      { type: 'boolean' },
            message:    { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      ok: { type: 'boolean' },
    },
    additionalProperties: false,
  },

  // build:* — the surface that had no schema at all, so no `mfe:build:*` tool
  // existed and an agent over MCP could not build what it had just scaffolded.
  // Shapes from src/commands/build/check.ts and src/oclif/results.ts.
  'build:check': {
    type: 'object',
    required: ['plugin', 'framework', 'bundler', 'checks', 'allPassed'],
    properties: {
      plugin:    { type: 'string' },
      framework: { type: 'string' },
      bundler:   { type: 'string' },
      checks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['tool', 'required', 'found', 'ok'],
          properties: {
            tool:     { type: 'string' },
            required: { type: 'string' },
            found:    { type: ['string', 'null'] },
            ok:       { type: 'boolean' },
            fix:      { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      allPassed: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  'build:dev': {
    type: 'object',
    required: ['plugin', 'framework', 'bundler', 'url', 'port'],
    properties: {
      plugin:    { type: 'string' },
      framework: { type: 'string' },
      bundler:   { type: 'string' },
      url:       { type: 'string' },
      port:      { type: 'number' },
    },
    additionalProperties: false,
  },
  'build:docker': {
    type: 'object',
    required: ['plugin', 'framework', 'bundler', 'dockerfilePath', 'built'],
    properties: {
      plugin:         { type: 'string' },
      framework:      { type: 'string' },
      bundler:        { type: 'string' },
      dockerfilePath: { type: 'string' },
      imageTag:       { type: 'string' },
      built:          { type: 'boolean' },
    },
    additionalProperties: false,
  },
  'build:prod': {
    type: 'object',
    required: ['plugin', 'framework', 'bundler', 'success', 'artifacts', 'duration_ms', 'warnings', 'errors'],
    properties: {
      plugin:      { type: 'string' },
      framework:   { type: 'string' },
      bundler:     { type: 'string' },
      success:     { type: 'boolean' },
      artifacts:   { type: 'array', items: { type: 'string' } },
      duration_ms: { type: 'number' },
      warnings:    { type: 'array', items: { type: 'string' } },
      // BuildError (packages/contracts/src/framework-plugin.ts). `category` is
      // 'unknown' for every real failure today — the parsers are still to come
      // (#139) — but the contract an agent reads is already this shape.
      errors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['message', 'category'],
          properties: {
            file:       { type: 'string' },
            line:       { type: 'number' },
            column:     { type: 'number' },
            message:    { type: 'string' },
            category:   { type: 'string', enum: ['syntax', 'type', 'dependency', 'config', 'runtime', 'unknown'] },
            suggestion: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};


// ---------------------------------------------------------------------------
// Build and write
// ---------------------------------------------------------------------------

function schemaFilename(commandName: string): string {
  return commandName.replace(/:/g, '-') + '.json';
}

function buildSchema(command: RegistryCommand): object {
  const output = OUTPUT_SCHEMAS[command.id];
  if (!output) {
    throw new Error(
      `No output schema for "${command.id}".\n\n` +
      `Every catalogued command needs one — it is what an agent parses out of the\n` +
      `--json envelope, and it cannot be derived from the TypeScript result type.\n\n` +
      `Either add "${command.id}" to OUTPUT_SCHEMAS in scripts/generate-schemas.ts,\n` +
      `or, if it should not be an agent-facing tool, add it to CATALOG_EXCLUDED in\n` +
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
  const expected = new Set(commands.map((c) => schemaFilename(c.id)));
  let drifted = false;

  for (const command of commands) {
    const json = JSON.stringify(buildSchema(command), null, 2) + '\n';
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
