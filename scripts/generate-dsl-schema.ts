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
import { ControlPlaneDocumentSchema } from '../packages/dsl/src/control-plane-schema';

const OUT_DIR = path.resolve(__dirname, '..', 'schemas', 'dsl');
const OUT_FILE = path.join(OUT_DIR, 'manifest.schema.json');
const CONTROL_PLANE_OUT_FILE = path.join(OUT_DIR, 'control-plane.schema.json');
const CHECK_MODE = process.argv.includes('--check');

/** Generate, then either write or diff. Returns false when --check found staleness. */
function emit(outFile: string, rendered: string): boolean {
  if (CHECK_MODE) {
    const existing = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;
    if (existing !== rendered) {
      process.stderr.write(
        `${path.relative(process.cwd(), outFile)} is stale — run \`npm run build:schema:dsl\` and commit the result.\n`
      );
      return false;
    }
    process.stdout.write(`${path.relative(process.cwd(), outFile)} is up to date.\n`);
    return true;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outFile, rendered);
  process.stdout.write(`Wrote ${path.relative(process.cwd(), outFile)}\n`);
  return true;
}

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

  // The project-scoped composition document (ADR-083). Same generation
  // contract as the manifest schema above: zod is the source of truth, the
  // JSON Schema is the editor-facing artifact, and neither is hand-edited.
  const controlPlaneDocument = {
    $id: 'https://github.com/falese/seans-mfe-tool/schemas/dsl/control-plane.schema.json',
    title: 'seans-mfe-tool control-plane composition',
    description:
      'Project-scoped composition document (control-plane.yaml) compiled into the ' +
      'registry payload by `seans-mfe-tool control-plane:build`. Generated from ' +
      'packages/dsl/src/control-plane-schema.ts (zod) by scripts/generate-dsl-schema.ts — ' +
      'do not hand-edit.',
    ...z.toJSONSchema(ControlPlaneDocumentSchema, {
      target: 'draft-2020-12',
      unrepresentable: 'any',
    }),
  };
  const controlPlaneRendered = JSON.stringify(controlPlaneDocument, null, 2) + '\n';

  const ok = [
    emit(OUT_FILE, rendered),
    emit(CONTROL_PLANE_OUT_FILE, controlPlaneRendered),
    // Both are emitted before exiting so --check reports every stale file in
    // one run rather than making the caller rediscover them one at a time.
  ].every(Boolean);

  if (!ok) process.exit(1);
}

main();
