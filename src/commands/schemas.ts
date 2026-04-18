/**
 * seans-mfe-tool schemas
 *
 * Reads all schema files from schemas/ (or dist/schemas/ when published) and
 * emits a combined catalog. Always outputs JSON — the --json flag wraps it in
 * the full CommandResult envelope; without --json the catalog is printed raw.
 *
 * Refs #105 (B6)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseCommand } from '../oclif/BaseCommand';

export interface SchemaCatalog {
  cliVersion: string;
  commands: CommandSchema[];
}

export interface CommandSchema {
  name: string;
  description?: string;
  input: object;
  output: object;
  errorCodes: number[];
}

export async function schemasCommand(): Promise<SchemaCatalog> {
  const schemasDir = resolveSchemaDir();
  const files = await fs.readdir(schemasDir);
  const schemaFiles = files.filter((f) => f.endsWith('.json'));

  const commands: CommandSchema[] = [];
  for (const file of schemaFiles.sort()) {
    const raw = await fs.readJson(path.join(schemasDir, file));
    commands.push({
      name:        raw.title   ?? file.replace('.json', ''),
      description: raw.description,
      input:       raw.input   ?? {},
      output:      raw.output  ?? {},
      errorCodes:  raw.errorCodes ?? [],
    });
  }

  // Read CLI version from nearest package.json
  let cliVersion = '0.0.0';
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = await fs.readJson(pkgPath);
    cliVersion = pkg.version ?? cliVersion;
  } catch { /* best-effort */ }

  return { cliVersion, commands };
}

function resolveSchemaDir(): string {
  // Published: dist/schemas/ → sibling of dist/commands/
  const distSchemas = path.resolve(__dirname, '..', 'schemas');
  if (fs.existsSync(distSchemas)) return distSchemas;

  // Development: schemas/ at project root
  const devSchemas = path.resolve(__dirname, '..', '..', 'schemas');
  if (fs.existsSync(devSchemas)) return devSchemas;

  throw new Error(`schemas/ directory not found. Run: npm run build:schemas`);
}

export default class Schemas extends BaseCommand<SchemaCatalog> {
  static description = 'List all available command schemas (tool catalog)'

  static examples = [
    '# List all command names\n$ seans-mfe-tool schemas | jq \'.commands[].name\'',
    '# Full catalog in CommandResult envelope\n$ seans-mfe-tool schemas --json',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
  }

  protected async runCommand(): Promise<SchemaCatalog> {
    const catalog = await schemasCommand();

    if (!this.argv.includes('--json')) {
      // Always emit JSON even in human mode (schemas are inherently structured)
      process.stdout.write(JSON.stringify(catalog, null, 2) + '\n');
    }

    return catalog;
  }
}
