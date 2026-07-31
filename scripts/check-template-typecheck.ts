#!/usr/bin/env ts-node
/**
 * Fresh-scaffold typecheck gate for the base-mfe template lanes (#281).
 *
 * The React (`base-mfe/`) and Angular (`base-mfe-angular/`) template trees
 * encode the same BaseMFE lifecycle contract twice and are edited
 * independently, so they drift in both directions (DX-REPORT "Meta-finding:
 * the React and Angular templates drift"). The regressions that motivated this
 * gate — Angular's `tsconfig.app.json.ejs` shipping a `"//"` comment key, and
 * React's `bootstrap.ts.ejs` passing a partial `Context` — were both masked by
 * swc builds and isolated ts-jest; only `tsc --noEmit` against a *real*,
 * `npm install`-ed, freshly generated project surfaces them. The in-memory
 * cross-framework contract test (`cross-framework-contract.test.ts`) is the
 * generic guard for the string-level lifecycle surface; this script is the
 * generic guard for the compile-level surface those assertions can't see.
 *
 * For each framework this: generates a scratch MFE from a minimal manifest
 * (mirroring `remote:init` + `remote:generate`), installs its real
 * dependencies, then runs the same `mfe:validate --typecheck` a developer
 * would run by hand — so a fix to one path fixes both.
 *
 * Usage:
 *   npx ts-node scripts/check-template-typecheck.ts            # react + angular
 *   npx ts-node scripts/check-template-typecheck.ts --keep      # keep scratch dirs
 *   npx ts-node scripts/check-template-typecheck.ts react       # one lane only
 */

import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { generateAllFiles, writeGeneratedFiles } from '@falese/smt-codegen';
import { writeManifest, generateEndpoints } from '@falese/smt-dsl';
import type { DSLManifest } from '@falese/smt-dsl';
import { mfeValidateCommand } from '../src/commands/mfe/validate';

interface Lane {
  framework: string;
  bundler: string;
  port: number;
}

const LANES: Lane[] = [
  { framework: 'react', bundler: 'rspack', port: 4101 },
  { framework: 'angular', bundler: 'webpack', port: 4102 },
];

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_RUNTIME = path.join(REPO_ROOT, 'dist', 'runtime');

const KEEP = process.argv.includes('--keep');
const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const lanes = requested.length > 0 ? LANES.filter((l) => requested.includes(l.framework)) : LANES;

function scratchManifest(lane: Lane): DSLManifest {
  // Mirrors exactly what `remote:init` writes (name, port -> endpoint +
  // remoteEntry via generateEndpoints) so the probe is realistic. Deliberately
  // no `data:` section — BFF gating is already the cross-framework contract
  // test's job (#271); this gate is scoped to the shared lifecycle surface,
  // where both original regressions (DX punch items 8 and 17) actually lived.
  return {
    name: 'template-typecheck-probe',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: lane.framework,
    bundler: lane.bundler,
    description: `Scratch probe manifest (${lane.framework}) — #281 typecheck gate`,
    capabilities: [{ DataAnalysis: { type: 'domain', description: 'Analyze data' } }],
    ...generateEndpoints('template-typecheck-probe', lane.port),
  } as DSLManifest;
}

async function checkLane(lane: Lane): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `template-typecheck-${lane.framework}-`));
  console.log(`\n=== ${lane.framework} ===`);
  console.log(`scratch dir: ${dir}`);
  try {
    const manifest = scratchManifest(lane);
    // `mfe:validate` (invoked below) reads mfe-manifest.yaml off disk like a
    // real MFE directory — remote:init's job, not generateAllFiles's.
    await writeManifest(manifest, path.join(dir, 'mfe-manifest.yaml'));
    const { files } = await generateAllFiles(manifest, dir, { force: true });
    await writeGeneratedFiles(files, { force: true });

    // `@falese/smt-runtime` isn't published to npm yet (ADR-064) — real
    // Dockerfiles stage it via `npm pkg set ... file:.../dist/runtime`
    // (`scripts/copy-runtime-files.js`). Mirror that here so a plain
    // `npm install` in the scratch dir resolves the same way a real build does.
    const pkgJsonPath = path.join(dir, 'package.json');
    const pkgJson = await fs.readJson(pkgJsonPath);
    if (pkgJson.devDependencies?.['@falese/smt-runtime']) {
      pkgJson.devDependencies['@falese/smt-runtime'] = `file:${DIST_RUNTIME}`;
    }
    if (pkgJson.dependencies?.['@falese/smt-runtime']) {
      pkgJson.dependencies['@falese/smt-runtime'] = `file:${DIST_RUNTIME}`;
    }
    await fs.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });

    console.log(`[${lane.framework}] npm install ...`);
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: dir,
      stdio: 'inherit',
    });

    console.log(`[${lane.framework}] mfe:validate --typecheck ...`);
    await mfeValidateCommand({ dir, typecheck: true });
    console.log(`[${lane.framework}] OK`);
  } finally {
    if (KEEP) {
      console.log(`kept scratch dir: ${dir}`);
    } else {
      await fs.remove(dir);
    }
  }
}

async function main(): Promise<void> {
  if (!(await fs.pathExists(DIST_RUNTIME))) {
    console.error(`dist/runtime not found at ${DIST_RUNTIME} — run \`npm run build\` first.`);
    process.exit(1);
  }
  if (lanes.length === 0) {
    console.error(`No matching lane(s) in: ${requested.join(', ')} (known: ${LANES.map((l) => l.framework).join(', ')})`);
    process.exit(1);
  }

  const failures: string[] = [];
  for (const lane of lanes) {
    try {
      await checkLane(lane);
    } catch (err) {
      failures.push(lane.framework);
      console.error(`[${lane.framework}] FAILED: ${(err as Error).message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nTemplate typecheck gate failed for: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log(`\nAll ${lanes.length} template lane(s) typecheck cleanly from a fresh, installed scaffold.`);
}

main().catch((err) => {
  console.error('check-template-typecheck failed:', (err as Error).message || err);
  process.exit(1);
});
