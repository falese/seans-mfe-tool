#!/usr/bin/env ts-node
/**
 * Generates the JSON Schema for the DSL manifest from the zod source of truth
 * (packages/dsl/src/schema.ts) via zod v4's native z.toJSONSchema.
 *
 * Output: schemas/dsl/manifest.schema.json — a generated artifact, never
 * hand-edited (same contract as the command schemas in schemas/).
 *
 * Usage:
 *   npm run build:schema:dsl             # generate + write
 *   npm run build:schema:dsl -- --check  # generate + diff (fails if stale)
 *
 * Refs #264, ADR-065
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { DSLManifestSchema } from '../packages/dsl/src/schema';

const OUT_DIR = path.resolve(__dirname, '..', 'schemas', 'dsl');
const OUT_FILE = path.join(OUT_DIR, 'manifest.schema.json');
const CHECK_MODE = process.argv.includes('--check');

function main(): void {
  const jsonSchema = z.toJSONSchema(DSLManifestSchema, {
    target: 'draft-2020-12',
    // The manifest schema uses open fields (framework/bundler are open
    // strings per ADR-036; authorization is deferred per ADR-007) —
    // represent unrepresentable zod constructs permissively instead of
    // failing generation.
    unrepresentable: 'any',
  });

  const document = {
    $id: 'https://github.com/falese/seans-mfe-tool/schemas/dsl/manifest.schema.json',
    title: 'seans-mfe-tool DSL manifest',
    description:
      'MFE manifest accepted by seans-mfe-tool codegen. Generated from ' +
      'packages/dsl/src/schema.ts (zod) by scripts/generate-dsl-schema.ts — do not hand-edit.',
    ...jsonSchema,
  };

  const rendered = JSON.stringify(document, null, 2) + '\n';

  if (CHECK_MODE) {
    const existing = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
    if (existing !== rendered) {
      process.stderr.write(
        `schemas/dsl/manifest.schema.json is stale — run \`npm run build:schema:dsl\` and commit the result.\n`
      );
      process.exit(1);
    }
    process.stdout.write('schemas/dsl/manifest.schema.json is up to date.\n');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, rendered);
  process.stdout.write(`Wrote ${path.relative(process.cwd(), OUT_FILE)}\n`);
}

main();
