import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')

describe('bin entries (issue #90)', () => {
  it('bin/dev.ts exists with bun shebang and oclif import', () => {
    const content = fs.readFileSync(path.join(ROOT, 'bin/dev.ts'), 'utf8')
    expect(content.startsWith('#!/usr/bin/env bun')).toBe(true)
    expect(content).toContain("from '@oclif/core'")
  })

  it('bin/run.js exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'bin/run.js'))).toBe(true)
  })

  it('node bin/run.js --help exits 0 and prints seans-mfe-tool', () => {
    const result = spawnSync('node', ['bin/run.js', '--help'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect((result.stdout ?? '') + (result.stderr ?? '')).toMatch(/seans-mfe-tool/i)
  })

  it('package.json has oclif section with required fields', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.oclif).toBeDefined()
    expect(pkg.oclif.bin).toBe('seans-mfe-tool')
    expect(pkg.oclif.dirname).toBe('seans-mfe-tool')
    // commands may be a string path or an object with strategy/target/globPatterns (A10)
    const commands = pkg.oclif.commands
    const target = typeof commands === 'string' ? commands : commands.target
    expect(target).toBe('./dist/commands')
    expect(pkg.oclif.plugins).toContain('@oclif/plugin-help')
    expect(pkg.oclif.plugins).toContain('@oclif/plugin-plugins')
  })

  it('bin/seans-mfe-tool.js is deleted (A7 cut-over complete)', () => {
    expect(fs.existsSync(path.join(ROOT, 'bin/seans-mfe-tool.js'))).toBe(false)
  })

  it('package.json bin points to bin/run.js', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.bin['seans-mfe-tool']).toBe('./bin/run.js')
  })

  it('commander is absent from package.json dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.dependencies?.commander).toBeUndefined()
  })
})
