#!/usr/bin/env bun
import { run, flush, handle } from '@oclif/core'

await run(process.argv.slice(2), import.meta.url)
  .catch(handle)
  .finally(() => flush())
