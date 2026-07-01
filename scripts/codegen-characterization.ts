/**
 * Codegen characterization harness (#238 D3).
 *
 * Generates the full file set for every abc-kids manifest via generateAllFiles
 * (dry run — no disk writes) and prints a stable, sorted JSON of
 * { manifestDir, files: [{ path, overwrite, sha256 }] }.
 *
 * Run before and after the generator refactor; the output MUST be identical
 * (byte-for-byte generated artifacts is a hard invariant).
 *
 *   npx ts-node scripts/codegen-characterization.ts > /tmp/codegen-before.json
 *   # ...refactor...
 *   npx ts-node scripts/codegen-characterization.ts > /tmp/codegen-after.json
 *   diff /tmp/codegen-before.json /tmp/codegen-after.json && echo IDENTICAL
 */
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { parseAndValidateDirectory } from '../src/dsl';
import { generateAllFiles } from '../src/codegen/UnifiedGenerator/unified-generator';

const EXAMPLES = path.resolve(__dirname, '../examples/abc-kids');

async function main() {
  const outFile = process.argv[2] || '/tmp/codegen-snapshot.json';
  // The DSL parser / generator log progress to stdout+stderr; silence them so
  // only the JSON snapshot is produced.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.log = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.error = () => {};
  const dirs = fs
    .readdirSync(EXAMPLES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(EXAMPLES, d.name, 'mfe-manifest.yaml')))
    .map((d) => d.name)
    .sort();

  const out: unknown[] = [];
  for (const dir of dirs) {
    const cwd = path.join(EXAMPLES, dir);
    const result = await parseAndValidateDirectory(cwd);
    if (!result.valid || !result.manifest) {
      out.push({ manifestDir: dir, error: 'invalid-manifest' });
      continue;
    }
    const { files, preservedCapabilities } = await generateAllFiles(result.manifest, cwd, {
      force: true,
      dryRun: true,
    });
    const hashed = files
      .map((f) => ({
        path: f.path.replace(cwd, '<cwd>'),
        overwrite: f.overwrite,
        sha256: createHash('sha256').update(f.content).digest('hex'),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    out.push({
      manifestDir: dir,
      framework: (result.manifest as { framework?: string }).framework ?? 'react',
      bundler: (result.manifest as { bundler?: string }).bundler ?? 'rspack',
      preservedCapabilities: [...preservedCapabilities].sort(),
      fileCount: hashed.length,
      files: hashed,
    });
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
  process.stderr.write(`wrote ${outFile}\n`);
}

main().catch((err) => {
  process.stderr.write(String(err && (err as Error).stack ? (err as Error).stack : err) + '\n');
  process.exit(1);
});
