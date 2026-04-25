import { BaseCommand } from '../BaseCommand'

// ---------------------------------------------------------------------------
// Dummy subclass — no Config.load() needed to test static structure.
// Dynamic behaviour (JSON envelope, exit codes, stdout split) is covered
// by envelope.test.ts and json-contract.test.ts.
// ---------------------------------------------------------------------------

class TestCommand extends BaseCommand<{ ok: boolean }> {
  static flags = { ...BaseCommand.baseFlags }
  protected async runCommand() {
    return { ok: true }
  }
}

describe('BaseCommand', () => {
  it('re-exports BaseCommand from @seans-mfe/oclif-base via the shim', () => {
    expect(BaseCommand).toBeDefined()
    expect(typeof BaseCommand).toBe('function')
  })

  it('declares baseFlags with a boolean --json flag', () => {
    expect(BaseCommand.baseFlags).toBeDefined()
    expect(BaseCommand.baseFlags.json).toBeDefined()
    expect(BaseCommand.baseFlags.json.type).toBe('boolean')
  })

  it('subclass inherits --json flag via baseFlags spread', () => {
    expect(TestCommand.flags.json).toBeDefined()
    expect(TestCommand.flags.json.type).toBe('boolean')
  })
})
