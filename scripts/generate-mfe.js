#!/usr/bin/env node
/**
 * Standalone MFE codegen runner.
 *
 * Invokes the same logic as `seans-mfe-tool remote:generate` without the oclif CLI
 * framework or workspace packages (@seans-mfe/contracts, @seans-mfe/oclif-base).
 * Used by Docker builds so the CLI can regenerate platform files from mfe-manifest.yaml
 * on every build without needing a fully-installed workspace.
 *
 * Usage:
 *   node <path-to-this-script>            # from MFE root (reads mfe-manifest.yaml in CWD)
 *   node <path-to-this-script> --dry-run  # preview only
 *
 * In Docker: ENV SEANS_MFE_SCRIPT=/seans-mfe-tool/scripts/generate-mfe.js
 * Locally:   ../../scripts/generate-mfe.js (default in package.json generate script)
 */
'use strict';

// ts-node with transpileOnly=true: compiles TypeScript on the fly without type-checking.
// This avoids failures caused by missing workspace packages (contracts, oclif-base) which
// are only needed by the CLI command wrapper, not the codegen core.
require('ts-node').register({
  project: require('path').join(__dirname, '..', 'tsconfig.json'),
  transpileOnly: true,
});

const path = require('path');
const { parseAndValidateDirectory, formatErrorsForCLI } = require('../src/dsl');
const { generateAllFiles, writeGeneratedFiles } = require('../src/codegen/UnifiedGenerator/unified-generator');

const dryRun = process.argv.includes('--dry-run');
const cwd = process.cwd();

async function run() {
  console.log(`Generating platform files from mfe-manifest.yaml in ${cwd}...`);

  const result = await parseAndValidateDirectory(cwd);

  if (!result.valid || !result.manifest) {
    console.error('Invalid manifest:');
    if (typeof formatErrorsForCLI === 'function') {
      console.error(formatErrorsForCLI(result.errors));
    } else {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    process.exit(1);
  }

  const manifest = result.manifest;
  console.log(`Validated: ${manifest.name} v${manifest.version}`);

  const allFiles = await generateAllFiles(manifest, cwd);

  if (dryRun) {
    console.log('[DRY RUN] Would generate:');
    allFiles.forEach((f) => console.log(`  ${path.relative(cwd, f.path)} ${f.overwrite ? '(overwrite)' : '(new)'}`));
    return;
  }

  const genResult = await writeGeneratedFiles(allFiles);

  if (genResult.errors.length > 0) {
    console.error('Generation errors:');
    genResult.errors.forEach((e) => console.error(' ', e));
    process.exit(1);
  }

  if (genResult.files.length > 0) {
    console.log(`Generated ${genResult.files.length} file(s):`);
    genResult.files.forEach((f) => console.log(`  ${path.relative(cwd, f.path)}`));
  }

  if (genResult.skipped.length > 0) {
    console.log(`Skipped ${genResult.skipped.length} existing file(s) (use --force to overwrite)`);
  }
}

run().catch((err) => {
  console.error('Generate failed:', err.message || err);
  process.exit(1);
});
