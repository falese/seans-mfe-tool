#!/usr/bin/env node
/**
 * Post-build cleanup for runtime package
 * Ensures the compiled dist/runtime package is ready and removes redundant platform-runtime
 */

const fs = require('fs-extra');
const path = require('path');

const distRuntime = path.join(__dirname, '../dist/runtime');
const distPlatformRuntime = path.join(__dirname, '../dist/platform-runtime');
const srcTemplates = path.join(__dirname, '../src/codegen/templates');
const distTemplates = path.join(__dirname, '../dist/codegen/templates');
const contractsPkg = path.join(__dirname, '../packages/contracts');
const bundledContracts = path.join(distRuntime, 'node_modules/@seans-mfe/contracts');

async function cleanupRuntimeFiles() {
  console.log('🧹 Cleaning up runtime build artifacts...');

  try {
    // Verify dist/runtime exists (created by TypeScript compiler)
    if (await fs.pathExists(distRuntime)) {
      console.log('  ✓ Verified dist/runtime package exists');
    } else {
      console.warn('  ⚠ Warning: dist/runtime not found - TypeScript build may have failed');
    }

    // Write package.json to dist/runtime/ so it can be installed via file: reference.
    // This allows Dockerfiles to do:
    //   npm pkg set devDependencies['@seans-mfe-tool/runtime']='file:/seans-mfe-tool/dist/runtime'
    // and get compiled .js + .d.ts without traversing TypeScript source (and its
    // transitive deps like zod/dsl/schema).
    //
    // Once the inlined src/runtime/contracts.ts mirror is deleted (#236),
    // barrel-reachable modules import the real @seans-mfe/contracts, so the
    // compiled runtime emits a single require("@seans-mfe/contracts"). To keep
    // dist/runtime self-contained (its whole reason for existing) that package
    // is *bundled*: its compiled output is copied into
    // dist/runtime/node_modules/@seans-mfe/contracts and listed in
    // bundledDependencies. npm strips a file: dependency's own node_modules when
    // it packs it, but preserves anything in bundledDependencies — so
    // `npm install file:/seans-mfe-tool/dist/runtime` carries the contract
    // package into every generated MFE with NO change to any generated MFE
    // Dockerfile or bundler config. The same physical copy resolves in the CLI
    // image too (node walks up to dist/runtime/node_modules first). contracts
    // has zero runtime deps and ships only its compiled dist/, so the bundle is
    // tiny and the install stays shallow (the reason the mirror existed).
    await fs.writeJson(path.join(distRuntime, 'package.json'), {
      name: '@seans-mfe-tool/runtime',
      version: '0.1.0',
      main: './index.js',
      types: './index.d.ts',
      dependencies: {
        '@seans-mfe/contracts': 'file:/seans-mfe-tool/packages/contracts',
      },
      bundledDependencies: ['@seans-mfe/contracts'],
      exports: {
        '.':         { require: './index.js',  import: './index.js',  default: './index.js',  types: './index.d.ts'   },
        './angular': { require: './angular.js', import: './angular.js', default: './angular.js', types: './angular.d.ts' },
        './package.json': './package.json'
      }
    }, { spaces: 2 });
    console.log('  ✓ Wrote dist/runtime/package.json (installable via file: reference)');

    // Bundle @seans-mfe/contracts (compiled) into dist/runtime so the runtime's
    // require("@seans-mfe/contracts") resolves everywhere without a separate
    // install. Copy the package.json + dist/ verbatim to preserve its main
    // (./dist/index.js) and subpath exports.
    if (await fs.pathExists(path.join(contractsPkg, 'dist', 'index.js'))) {
      await fs.emptyDir(bundledContracts);
      await fs.copy(path.join(contractsPkg, 'dist'), path.join(bundledContracts, 'dist'), { overwrite: true });
      await fs.copy(path.join(contractsPkg, 'package.json'), path.join(bundledContracts, 'package.json'), { overwrite: true });
      console.log('  ✓ Bundled @seans-mfe/contracts into dist/runtime/node_modules');
    } else {
      console.warn('  ⚠ packages/contracts/dist not found — run build:packages first; runtime bundle will be incomplete');
    }

    // Remove redundant platform-runtime directory
    if (await fs.pathExists(distPlatformRuntime)) {
      await fs.remove(distPlatformRuntime);
      console.log('  ✓ Removed redundant dist/platform-runtime');
    }

    // Copy EJS templates to dist/ (tsc doesn't copy non-TS files)
    await fs.copy(srcTemplates, distTemplates, { overwrite: true });
    console.log('  ✓ Copied codegen templates to dist/codegen/templates');

    console.log('✅ Runtime cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup runtime files:', error);
    process.exit(1);
  }
}

cleanupRuntimeFiles();
