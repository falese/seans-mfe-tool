#!/usr/bin/env ts-node
/**
 * The extraction acceptance test: do the PUBLISHED packages generate an MFE?
 *
 * Every other gate in this repo runs from a monorepo checkout, where every path
 * resolves whether or not the file would ship. That is how two separate defects
 * stayed invisible until the extraction work:
 *
 *   @seans-mfe/plugin-bff  omitted `templates` from package.json#files, so
 *                          `npm pack` produced a tarball with zero templates
 *                          and the published plugin could not scaffold at all.
 *   @seans-mfe/codegen     reached the BFF templates through a relative path
 *                          that escaped its own package root.
 *
 * Both are fixed. This is what keeps them fixed, and what answers the question
 * the whole plan exists to answer — can this be lifted out and used?
 *
 * Method: `npm pack` each package, unpack the tarballs into a scratch
 * `node_modules` containing nothing else, and generate a real MFE from a real
 * manifest using only what came out of those tarballs. That no repo source is
 * on the resolution path is asserted, not assumed.
 *
 * Refs: docs/generator-extraction-plan.md Phase 5 · ADR-092
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * The packages an extracted generator consists of, in dependency order.
 *
 * `plugin-bff` is here because a BFF-bearing manifest is what exercises the
 * contributor seam — the half that was broken in both directions.
 */
const PACKAGES = ['contracts', 'dsl', 'codegen', 'plugin-bff'] as const;

/** Exercises all three lanes: a capability, a slot, and a data: section. */
const MANIFEST = `name: publish-shape-probe
version: 1.0.0
type: remote
language: typescript
framework: react
bundler: rspack
endpoint: http://localhost:3199
capabilities:
  - Dashboard:
      type: domain
      description: probe capability
providesSlots:
  - id: dashboard.header
    description: probe slot
data:
  sources:
    - name: Probe
      handler:
        openapi:
          source: ./specs/probe.yaml
  serve:
    endpoint: /graphql
    playground: true
`;

const DRIVER = `
const path = require('path');
const { parseAndValidateDirectory } = require('@seans-mfe/dsl');
const { generateAllFiles } = require('@seans-mfe/codegen');
require('@seans-mfe/plugin-bff/codegen');

// Prove nothing resolved back into the repo checkout.
for (const id of ['@seans-mfe/contracts', '@seans-mfe/dsl', '@seans-mfe/codegen']) {
  const resolved = require.resolve(id);
  if (!resolved.startsWith(process.env.SCRATCH)) {
    console.error('RESOLVED_OUTSIDE_SCRATCH ' + id + ' -> ' + resolved);
    process.exit(2);
  }
}

(async () => {
  const dir = process.argv[2];
  const parsed = await parseAndValidateDirectory(dir);
  if (!parsed.valid) {
    console.error('MANIFEST_INVALID ' + JSON.stringify(parsed.errors));
    process.exit(3);
  }
  const { files, diagnostics } = await generateAllFiles(parsed.manifest, dir);
  console.log(JSON.stringify({
    count: files.length,
    paths: files.map((f) => path.relative(dir, f.path)).sort(),
    diagnostics,
  }));
})().catch((e) => { console.error('THREW ' + ((e && e.stack) || e)); process.exit(4); });
`;

/** What a complete generation must contain, one entry per subsystem. */
const REQUIRED = [
  'src/platform/base-mfe/mfe.ts', // the lifecycle contract
  'src/features/Dashboard/Dashboard.tsx', // a domain capability
  'src/slots.tsx', // slot sugar (ADR-067)
  'src/platform/bff/bff.ts', // the BFF contributor's specs
  '.meshrc.yaml', // Mesh config, composed by the plugin
  'package.json',
  'rspack.config.js',
];

function run(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function pack(pkg: string, outDir: string): string {
  const dir = path.join(REPO_ROOT, 'packages', pkg);
  const printed = run('npm', ['pack', '--pack-destination', outDir, '--silent'], dir).trim();
  return path.join(outDir, printed.split('\n').pop() as string);
}

function unpack(tarball: string, nodeModules: string, scopedName: string): string {
  const dest = path.join(nodeModules, scopedName);
  fs.mkdirSync(dest, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', dest, '--strip-components=1'], REPO_ROOT);
  return dest;
}

function countFiles(dir: string): number {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return n;
}

function main(): void {
  // realpath, because `require.resolve` returns a realpath-resolved path while
  // `os.tmpdir()` may not be one: on macOS it is /var/folders/... , a symlink
  // to /private/var/folders/... , so the "did anything resolve outside the
  // scratch?" check below compared two spellings of the same directory and
  // failed with a false "Published packages cannot generate an MFE". Linux CI
  // never saw it because /tmp is its own realpath there.
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publish-shape-')));
  const tarDir = path.join(scratch, 'tarballs');
  const nodeModules = path.join(scratch, 'node_modules');
  fs.mkdirSync(tarDir, { recursive: true });
  fs.mkdirSync(nodeModules, { recursive: true });

  const failures: string[] = [];
  try {
    for (const pkg of PACKAGES) {
      const dest = unpack(pack(pkg, tarDir), nodeModules, `@seans-mfe/${pkg}`);
      process.stdout.write(`  packed @seans-mfe/${pkg}: ${countFiles(dest)} files\n`);
    }

    // Third-party runtime deps come from the repo's own node_modules: this
    // gate tests OUR packaging, not npm's resolver.
    for (const dep of ['ejs', 'fs-extra', 'js-yaml', 'zod', 'graceful-fs', 'universalify', 'jsonfile']) {
      const from = path.join(REPO_ROOT, 'node_modules', dep);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(nodeModules, dep), { recursive: true });
    }

    const project = path.join(scratch, 'project');
    fs.mkdirSync(path.join(project, 'specs'), { recursive: true });
    fs.writeFileSync(path.join(project, 'mfe-manifest.yaml'), MANIFEST);
    fs.writeFileSync(
      path.join(project, 'specs', 'probe.yaml'),
      'openapi: 3.0.0\ninfo:\n  title: Probe\n  version: 1.0.0\npaths: {}\n',
    );

    const driver = path.join(scratch, 'generate.js');
    fs.writeFileSync(driver, DRIVER);

    const output = execFileSync(process.execPath, [driver, project], {
      cwd: scratch,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: nodeModules, SCRATCH: scratch },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const result = JSON.parse(output.trim().split('\n').pop() as string) as {
      count: number;
      paths: string[];
      diagnostics: Array<{ severity: string; message: string }>;
    };

    for (const required of REQUIRED) {
      if (!result.paths.includes(required)) {
        failures.push(`missing from a published-only generation: ${required}`);
      }
    }
    for (const d of result.diagnostics) {
      if (d.severity === 'error') failures.push(`error diagnostic: ${d.message}`);
      else if (d.message.includes('missing template')) {
        failures.push(`template not shipped: ${d.message}`);
      }
    }

    process.stdout.write(`  generated ${result.count} files from published packages only\n`);
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    failures.push(`generation failed: ${(e.stderr || e.message || String(err)).trim()}`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    process.stderr.write('\nPublished packages cannot generate an MFE:\n');
    for (const f of failures) process.stderr.write(`  - ${f}\n`);
    process.stderr.write(
      '\nUsually a package.json#files omission, or a template resolved by a path that ' +
        'does not survive packing.\n',
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Published packages generate a complete MFE.\n');
}

main();
