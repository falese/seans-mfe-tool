#!/usr/bin/env node
/**
 * The anti-generate-games.mjs: a thin driver that only ever shells out to
 * the REAL CLI (PDR-001 upheld the honest way). It writes no application
 * code itself.
 *
 *   node scripts/generate.mjs             # re-run remote:generate in every MFE
 *   node scripts/generate.mjs --scaffold  # also remote:init any missing MFE dir
 *   node scripts/generate.mjs --check     # regen then fail if git diff is dirty
 *
 * The --check form is the CI invariant: generated artifacts must match the
 * manifests exactly (`node scripts/generate.mjs --check`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const station = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(station, '..', '..', 'bin', 'run.js');

/** The fleet roster — the single data table this driver runs from. */
const MFES = [
  { name: 'meridian-console', framework: 'react', port: 5001 },
  { name: 'meridian-docking-control', framework: 'angular', port: 5002 },
  { name: 'meridian-life-support', framework: 'angular', port: 5003 },
  { name: 'meridian-cargo-ops', framework: 'angular', port: 5004 },
  { name: 'meridian-crew-services', framework: 'react', port: 5005 },
  { name: 'meridian-concourse', framework: 'react', port: 5006 },
];

const args = new Set(process.argv.slice(2));
const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });

for (const mfe of MFES) {
  const dir = join(station, mfe.name);
  if (!existsSync(dir)) {
    if (!args.has('--scaffold')) {
      console.error(`missing ${mfe.name} — run with --scaffold to init it`);
      process.exit(1);
    }
    console.log(`── remote:init ${mfe.name} (${mfe.framework}:${mfe.port}) ──`);
    run(cli, ['remote:init', mfe.name, '--framework', mfe.framework, '--port', String(mfe.port), '--skip-install'], station);
  }
  console.log(`── remote:generate ${mfe.name} ──`);
  run(cli, ['remote:generate'], dir);
}

console.log('── derive-seeds ──');
run('node', [join(station, 'scripts', 'derive-seeds.mjs')], station);

if (args.has('--check')) {
  const diff = execFileSync('git', ['status', '--porcelain', station], { cwd: station })
    .toString()
    .trim();
  if (diff) {
    console.error('\nRegeneration produced a diff — generated artifacts have drifted from the manifests:\n' + diff);
    process.exit(1);
  }
  console.log('\nRegen invariant holds: no drift.');
}
