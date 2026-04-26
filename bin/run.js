#!/usr/bin/env node
'use strict'

const path = require('path')
const fs = require('fs')

// Transitional fallback: register ts-node if dist/ hasn't been built yet.
// A7 will remove this block once Commander is deleted and dist/ is always present.
const distDir = path.join(__dirname, '..', 'dist')
if (!fs.existsSync(distDir)) {
  require('ts-node').register({ transpileOnly: true })
}

const { run, flush, handle } = require('@oclif/core')

run(process.argv.slice(2), require.main?.filename)
  .catch(handle)
  .finally(() => flush())
