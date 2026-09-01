#!/usr/bin/env node
/**
 * Make `npm test` work on a fresh clone.
 *
 * Three suites spawn the real CLI or import built packages:
 *   - src/oclif/__tests__/json-contract.test.ts        (node bin/run.js -> dist/)
 *   - src/oclif/__tests__/output-schema-conformance.test.ts
 *   - src/oclif/__tests__/json-single-line.test.ts     (built workspace packages)
 *
 * Nothing declared that dependency, so `git clone && npm ci && npm test` — the
 * first thing anyone new runs — produced 34 failures whose message was
 * `Expected: 0, Received: 1`. The tests were right and the build order was
 * missing; the reader had no way to know that.
 *
 * The workspace build is incremental (`tsc -b`), so running it every time costs
 * ~0.3s warm. The full CLI build regenerates the oclif manifest and 19 schemas
 * with no caching (~12s), so it runs only when its output is absent — once, on
 * a fresh clone.
 *
 * Refs ADR-016, ADR-018 (the envelope contract those suites protect).
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const run = (script) =>
  execSync(`npm run ${script}`, { cwd: root, stdio: 'inherit' });

// Always: cheap and incremental.
run('build:packages');

// Only when missing: the CLI dist the integration suites spawn.
const cliDist = path.join(root, 'dist', 'commands');
if (!fs.existsSync(cliDist)) {
  process.stderr.write(
    '\n[ensure-build] dist/ is absent — building the CLI once so the ' +
      'integration suites can spawn it.\n' +
      '[ensure-build] This runs only on a fresh clone; later test runs skip it.\n\n',
  );
  run('build');
}
