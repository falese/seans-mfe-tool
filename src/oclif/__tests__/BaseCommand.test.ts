import { Config } from '@oclif/core'
import { BaseCommand } from '../BaseCommand'

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

  it('run() calls runCommand and logs JSON-stringified result', async () => {
    const cmd = new SuccessCommand([], config)
    const logSpy = jest.spyOn(cmd, 'log').mockImplementation(() => {})
    await cmd.run()
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ value: 42 }))
  })

  it('run() propagates errors thrown from runCommand', async () => {
    const cmd = new FailCommand([], config)
    jest.spyOn(cmd, 'log').mockImplementation(() => {})
    await expect(cmd.run()).rejects.toThrow('boom')
  })

  it('--json flag is parsed and available inside runCommand', async () => {
    const cmd = new JsonFlagCommand(['--json'], config)
    const logSpy = jest.spyOn(cmd, 'log').mockImplementation(() => {})
    await cmd.run()
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ jsonMode: true }))
  })

  it('--json defaults to false when not passed', async () => {
    const cmd = new JsonFlagCommand([], config)
    const logSpy = jest.spyOn(cmd, 'log').mockImplementation(() => {})
    await cmd.run()
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ jsonMode: false }))
  })
})
