#!/usr/bin/env node
/**
 * Post-compile cleanup: removes Commander migration shims from dist/commands/.
 * These shims exist in src/commands/ to preserve import paths during the A-epic
 * migration, but oclif's command scanner treats any .js file in dist/commands/
 * as a command module. Shims don't export a Command subclass, so oclif errors
 * ("command bff not found") when generating the manifest.
 *
 * The shims are NOT needed in dist/ — oclif discovers commands via the
 * nested directory structure (bff/, remote/). Remove after A7 when Commander
 * is deleted and shims are no longer needed.
 *
 * Refs: A10 (issue #99), A7 (issue #96)
 */
'use strict'

const fs = require('fs')
const path = require('path')

const DIST_COMMANDS = path.join(__dirname, '..', 'dist', 'commands')

/** Shim base names (without extension) — files that have a matching subdirectory */
const SHIMS = ['bff', 'create-api', 'remote-generate', 'remote-init']

for (const name of SHIMS) {
  for (const ext of ['.js', '.d.ts', '.d.ts.map', '.js.map']) {
    const filePath = path.join(DIST_COMMANDS, name + ext)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`  removed shim: dist/commands/${name}${ext}`)
    }
  }
}

console.log('remove-dist-shims: done')
