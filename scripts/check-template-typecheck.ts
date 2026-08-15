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
import { execFileSync, spawn } from 'child_process';
import * as http from 'http';
import { generateAllFiles, writeGeneratedFiles, normalizeLockfile } from '@falese/smt-codegen';
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
const MIRROR_DIR = path.join(REPO_ROOT, 'dist', 'registry');
const MIRROR_URL = process.env.SMT_MIRROR_URL ?? 'http://127.0.0.1:4873';

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

    // Install through the OFFLINE lane (ADR-084 §3), not by rewriting the
    // manifest.
    //
    // This used to overwrite `@falese/smt-runtime` with `file:${DIST_RUNTIME}`,
    // citing ADR-064 staging — the model ADR-084 replaced. That made the gate
    // set up exactly the state its own `runtime-declared` rule rejects, so the
    // probe failed validation on a defect the harness had introduced.
    //
    // Pointing the scope at the mirror instead means the gate exercises the
    // real thing: plain semver in package.json, the lane chosen by
    // configuration. The env var is deliberate — npm resolves
    // CLI flag > env > project .npmrc > ~/.npmrc, and generated MFEs now ship
    // a project .npmrc on the hosted lane, which a user-level override would
    // lose to.
    console.log(`[${lane.framework}] npm install (offline lane: ${MIRROR_URL}) ...`);
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: dir,
      stdio: 'inherit',
      env: { ...process.env, 'npm_config_@falese:registry': MIRROR_URL },
    });

    // Installing through the mirror locks every @falese/* entry to the mirror's
    // own tarball URL — the lane pin ADR-084 §5 forbids, and the defect the
    // sibling `lockfile-lane-independent` rule exists to catch. Applying the
    // same normalisation ADR-084 §5 requires of a generated MFE keeps the gate
    // modelling a lockfile a consumer could actually ship, instead of
    // manufacturing the one it must not.
    await normalizeLane(dir);

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

/** Strip the mirror's `resolved` URLs from the probe's lockfile (ADR-084 §5). */
async function normalizeLane(dir: string): Promise<void> {
  const lockPath = path.join(dir, 'package-lock.json');
  if (!(await fs.pathExists(lockPath))) return;

  const normalized = normalizeLockfile(await fs.readFile(lockPath, 'utf8'));
  if (normalized === null) return;

  await fs.writeFile(lockPath, normalized);
  console.log(`[lockfile] stripped lane-specific "resolved" URLs from @falese/* entries`);
}

/** Poll until the mirror answers, so the first install does not race startup. */
async function waitForMirror(url: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const up = await new Promise<boolean>((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(500, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (up) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`registry mirror did not come up at ${url}`);
}

async function main(): Promise<void> {
  if (!(await fs.pathExists(MIRROR_DIR))) {
    console.error(`registry mirror not found at ${MIRROR_DIR} — run \`npm run build\` first.`);
    process.exit(1);
  }
  if (lanes.length === 0) {
    console.error(`No matching lane(s) in: ${requested.join(', ')} (known: ${LANES.map((l) => l.framework).join(', ')})`);
    process.exit(1);
  }

  // Serve the offline mirror for the duration of the run (ADR-084 §3), in a
  // SEPARATE PROCESS.
  //
  // It cannot be an in-process server: the lanes install with `execFileSync`,
  // which blocks this process's event loop, so an in-process listener would
  // never answer npm's requests. The first version of this did exactly that and
  // hung until npm gave up — a deadlock that looks identical to a slow install.
  const mirror = spawn(
    process.execPath,
    [path.join(REPO_ROOT, 'scripts', 'serve-registry-mirror.js')],
    { stdio: 'inherit', env: { ...process.env, SMT_MIRROR_PORT: new URL(MIRROR_URL).port } }
  );
  await waitForMirror(MIRROR_URL);
  console.log(`registry mirror serving on ${MIRROR_URL}`);

  const failures: string[] = [];
  try {
    for (const lane of lanes) {
      try {
        await checkLane(lane);
      } catch (err) {
        failures.push(lane.framework);
        console.error(`[${lane.framework}] FAILED: ${(err as Error).message}`);
      }
    }
  } finally {
    mirror.kill();
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
