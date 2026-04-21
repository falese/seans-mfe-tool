import { Config } from '@oclif/core'
import { BaseCommand } from '../BaseCommand'

// Config.load and spawn are I/O-based; real timers needed.
jest.useRealTimers();

let config: Config

beforeAll(async () => {
  config = await Config.load({ root: process.cwd() })
})

// --- Dummy subclasses ---

class SuccessCommand extends BaseCommand<{ value: number }> {
  static flags = { ...BaseCommand.baseFlags }
  protected async runCommand() {
    return { value: 42 }
  }
}

class FailCommand extends BaseCommand<never> {
  static flags = { ...BaseCommand.baseFlags }
  protected async runCommand(): Promise<never> {
    throw new Error('boom')
  }
}

class JsonFlagCommand extends BaseCommand<{ jsonMode: boolean }> {
  static flags = { ...BaseCommand.baseFlags }
  protected async runCommand() {
    const { flags } = await this.parse(JsonFlagCommand)
    return { jsonMode: flags.json }
  }
}

// --- Tests ---

describe('BaseCommand', () => {
  it('exports BaseCommand from src/oclif/BaseCommand.ts', () => {
    expect(BaseCommand).toBeDefined()
  })

  it('declares baseFlags with a json boolean flag', () => {
    expect(BaseCommand.baseFlags).toBeDefined()
    expect(BaseCommand.baseFlags.json).toBeDefined()
    expect(BaseCommand.baseFlags.json.type).toBe('boolean')
  })

  it('subclass inherits --json flag via baseFlags spread', () => {
    expect(SuccessCommand.flags.json).toBeDefined()
  })

  it('run() completes without error in human mode', async () => {
    const cmd = new SuccessCommand([], config)
    await expect(cmd.run()).resolves.toBeUndefined()
  })

  it('run() propagates errors thrown from runCommand', async () => {
    const cmd = new FailCommand([], config)
    await expect(cmd.run()).rejects.toThrow('boom')
  })

  it('run() with --json calls process.exit(0) after writing the envelope', async () => {
    const cmd = new JsonFlagCommand(['--json'], config)
    // jest.setup.js mocks process.exit to throw Error('Process exit with code <n>').
    // Reaching this throw confirms: runCommand() succeeded AND JSON mode ran.
    await expect(cmd.run()).rejects.toThrow('Process exit with code 0')
  })

  it('--json defaults to false when not passed, run() completes without error', async () => {
    const cmd = new JsonFlagCommand([], config)
    await expect(cmd.run()).resolves.toBeUndefined()
  })
})
