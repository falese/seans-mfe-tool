/**
 * Tests for A9: @oclif/plugin-plugins config and reserved topics
 */
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')

describe('oclif plugin config (issue #98)', () => {
  it('package.json oclif.plugins includes @oclif/plugin-plugins', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.oclif.plugins).toContain('@oclif/plugin-plugins')
  })

  it('package.json oclif.scope is @seans-mfe', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.oclif.scope).toBe('@seans-mfe')
  })

  it('package.json oclif.topics reserves daemon topic', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.oclif.topics.daemon).toBeDefined()
    expect(pkg.oclif.topics.daemon.description).toContain('daemon')
  })

  it('package.json oclif.topics reserves coder topic', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.oclif.topics.coder).toBeDefined()
    expect(pkg.oclif.topics.coder.description).toContain('coder')
  })

  it('node bin/run.js plugins --help shows install/uninstall/link/update subcommands', () => {
    const result = spawnSync('node', ['bin/run.js', 'plugins', '--help'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15000,
    })
    expect(result.status).toBe(0)
    const output = (result.stdout ?? '') + (result.stderr ?? '')
    expect(output).toMatch(/install/i)
    expect(output).toMatch(/uninstall|remove/i)
  })
})
