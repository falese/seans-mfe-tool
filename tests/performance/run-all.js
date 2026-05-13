/**
 * Phase 1.4 — perf orchestrator.
 *
 * Runs every tests/performance/*.perf.js sequentially as a child process so
 * each scenario starts with a clean Node VM (no shared GC state) and so a
 * crash in one scenario does not poison the others. Exits non-zero if any
 * scenario exceeded its budget.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = __dirname;
const scenarios = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.perf.js'))
  .sort();

if (scenarios.length === 0) {
  console.error('no *.perf.js scenarios found in', dir);
  process.exit(1);
}

let failed = 0;
const results = [];

for (const file of scenarios) {
  const label = file.replace(/\.perf\.js$/, '');
  console.log(`\n=== ${label} ===`);
  const start = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, file)], {
    stdio: 'inherit',
    env: process.env,
  });
  const durationMs = Date.now() - start;
  const ok = r.status === 0;
  if (!ok) failed += 1;
  results.push({ label, ok, status: r.status, durationMs });
}

console.log('\n=== perf summary ===');
for (const r of results) {
  console.log(
    `  ${r.ok ? 'OK   ' : 'FAIL '} ${r.label.padEnd(30)} status=${r.status}  duration=${(r.durationMs / 1000).toFixed(2)}s`
  );
}

if (failed > 0) {
  console.error(`\n${failed} scenario(s) failed`);
  process.exit(1);
}
console.log('\nall scenarios passed');
