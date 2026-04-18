#!/usr/bin/env ts-node
/**
 * Generates JSON Schema documents for every seans-mfe-tool command.
 *
 * Each schema file describes the command's CLI inputs (flags + args) and the
 * TypeScript result interface exported from src/oclif/results.ts.
 *
 * Output: schemas/<command-name>.json  (one per command, topic:sub uses topic-sub)
 *
 * Usage:
 *   npm run build:schemas        # generate + write
 *   npm run build:schemas -- --check  # generate + diff (fails if stale)
 *
 * Refs #104 (B5)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const SCHEMAS_DIR = path.resolve(__dirname, '..', 'schemas');
const CHECK_MODE = process.argv.includes('--check');

const EXIT_CODES = [0, 2, 64, 65, 66, 69, 70, 77, 124];

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
    required: ['generated', 'skipped', 'errors', 'dryRun'],
    properties: {
      generated: { type: 'array', items: { type: 'string' } },
      skipped:   { type: 'array', items: { type: 'string' } },
      errors:    { type: 'array', items: { type: 'string' } },
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
};

// ---------------------------------------------------------------------------
// Input schemas (flags + args per command)
// ---------------------------------------------------------------------------

const INPUT_SCHEMAS: Record<string, object> = {
  deploy: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name:      { type: 'string', description: 'Application name' },
      type:      { type: 'string', enum: ['shell', 'remote', 'api'] },
      env:       { type: 'string', enum: ['development', 'production'], default: 'development' },
      port:      { type: 'string', default: '8080' },
      registry:  { type: 'string' },
      mode:      { type: 'string', enum: ['docker-compose', 'kubernetes'], default: 'docker-compose' },
      namespace: { type: 'string', default: 'default' },
      domain:    { type: 'string' },
      tag:       { type: 'string', default: 'latest' },
      memory:    { type: 'string', default: '256Mi' },
      cpu:       { type: 'string', default: '0.5' },
      replicas:  { type: 'string', default: '2' },
      'dry-run': { type: 'boolean', default: false },
    },
  },
  api: {
    type: 'object',
    required: ['name'],
    properties: {
      name:      { type: 'string', description: 'API name' },
      port:      { type: 'string', default: '3001' },
      spec:      { type: 'string', default: 'openapi.yaml' },
      database:  { type: 'string', enum: ['mongodb', 'mongo', 'sqlite', 'sql'], default: 'sqlite' },
      'dry-run': { type: 'boolean', default: false },
    },
  },
  'bff:init': {
    type: 'object',
    properties: {
      name:              { type: 'string' },
      port:              { type: 'string', default: '3000' },
      specs:             { type: 'array', items: { type: 'string' } },
      'no-static':       { type: 'boolean', default: false },
      'project-version': { type: 'string', default: '1.0.0' },
      'dry-run':         { type: 'boolean', default: false },
    },
  },
  'bff:build': {
    type: 'object',
    properties: {
      manifest:  { type: 'string', default: 'mfe-manifest.yaml' },
      'dry-run': { type: 'boolean', default: false },
    },
  },
  'bff:dev': {
    type: 'object',
    properties: {
      manifest: { type: 'string', default: 'mfe-manifest.yaml' },
    },
  },
  'bff:validate': {
    type: 'object',
    properties: {
      manifest: { type: 'string', default: 'mfe-manifest.yaml' },
    },
  },
  'remote:init': {
    type: 'object',
    required: ['name'],
    properties: {
      name:           { type: 'string' },
      port:           { type: 'string', default: '3001' },
      template:       { type: 'string' },
      'skip-install': { type: 'boolean', default: false },
      force:          { type: 'boolean', default: false },
      'dry-run':      { type: 'boolean', default: false },
    },
  },
  'remote:generate': {
    type: 'object',
    properties: {
      'dry-run': { type: 'boolean', default: false },
      force:     { type: 'boolean', default: false },
    },
  },
  'remote:generate:capability': {
    type: 'object',
    required: ['name'],
    properties: {
      name:      { type: 'string', description: 'Capability name' },
      'dry-run': { type: 'boolean', default: false },
      force:     { type: 'boolean', default: false },
    },
  },
};

// ---------------------------------------------------------------------------
// Build and write
// ---------------------------------------------------------------------------

function schemaFilename(commandName: string): string {
  return commandName.replace(/:/g, '-') + '.json';
}

function buildSchema(commandName: string): object {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://seans-mfe.dev/schemas/${commandName}.json`,
    title: commandName,
    description: `Input/output contract for seans-mfe-tool ${commandName}`,
    input:      INPUT_SCHEMAS[commandName]  ?? { type: 'object' },
    output:     OUTPUT_SCHEMAS[commandName] ?? { type: 'object' },
    errorCodes: EXIT_CODES,
  };
}

function main(): void {
  if (!fs.existsSync(SCHEMAS_DIR)) {
    fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
  }

  const commands = Object.keys(OUTPUT_SCHEMAS);
  let drifted = false;

  for (const cmd of commands) {
    const schema = buildSchema(cmd);
    const json = JSON.stringify(schema, null, 2) + '\n';
    const file = path.join(SCHEMAS_DIR, schemaFilename(cmd));

    if (CHECK_MODE) {
      if (!fs.existsSync(file)) {
        console.error(`MISSING: ${file}`);
        drifted = true;
        continue;
      }
      const existing = fs.readFileSync(file, 'utf8');
      if (existing !== json) {
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

  if (CHECK_MODE && drifted) {
    console.error('\nSchema drift detected. Run: npm run build:schemas');
    process.exit(1);
  }

  if (!CHECK_MODE) {
    console.log(`\n${commands.length} schema(s) generated in schemas/`);
  }
}

main();
