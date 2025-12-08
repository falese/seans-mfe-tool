#!/usr/bin/env node
/**
 * Post-build cleanup for runtime package
 * Ensures the compiled dist/runtime package is ready and removes redundant platform-runtime
 */

const fs = require('fs-extra');
const path = require('path');

const distRuntime = path.join(__dirname, '../dist/runtime');
const distPlatformRuntime = path.join(__dirname, '../dist/platform-runtime');

async function cleanupRuntimeFiles() {
  console.log('🧹 Cleaning up runtime build artifacts...');
  
  try {
    // Verify dist/runtime exists (created by TypeScript compiler)
    if (await fs.pathExists(distRuntime)) {
      console.log('  ✓ Verified dist/runtime package exists');
    } else {
      console.warn('  ⚠ Warning: dist/runtime not found - TypeScript build may have failed');
    }
    
    // Remove redundant platform-runtime directory
    if (await fs.pathExists(distPlatformRuntime)) {
      await fs.remove(distPlatformRuntime);
      console.log('  ✓ Removed redundant dist/platform-runtime');
    }
    
    console.log('✅ Runtime cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup runtime files:', error);
    process.exit(1);
  }
}

cleanupRuntimeFiles();
