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
    await fs.writeJson(path.join(distRuntime, 'package.json'), {
      name: '@seans-mfe-tool/runtime',
      version: '0.1.0',
      main: './index.js',
      types: './index.d.ts',
      exports: {
        '.':         { require: './index.js',  types: './index.d.ts'   },
        './angular': { require: './angular.js', types: './angular.d.ts' },
        './package.json': './package.json'
      }
    }, { spaces: 2 });
    console.log('  ✓ Wrote dist/runtime/package.json (installable via file: reference)');

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
