#!/usr/bin/env node
/**
 * Copy template files to codegen dist directory
 * Templates need to be available at runtime for code generation
 */

const fs = require('fs-extra');
const path = require('path');

const srcTemplates = path.join(__dirname, '../packages/codegen/src/templates');
const distTemplates = path.join(__dirname, '../packages/codegen/dist/templates');

async function copyTemplates() {
  console.log('📋 Copying codegen templates...');

  try {
    // Ensure dist directory exists
    await fs.ensureDir(path.join(__dirname, '../packages/codegen/dist'));

    // Copy templates directory
    if (await fs.pathExists(srcTemplates)) {
      await fs.copy(srcTemplates, distTemplates, {
        overwrite: true,
        errorOnExist: false
      });
      console.log(`  ✓ Copied templates from ${srcTemplates}`);
      console.log(`  ✓ To ${distTemplates}`);
    } else {
      console.warn('  ⚠ Warning: Source templates directory not found');
    }

    console.log('✅ Template copy completed');
  } catch (error) {
    console.error('❌ Failed to copy templates:', error);
    process.exit(1);
  }
}

copyTemplates();
