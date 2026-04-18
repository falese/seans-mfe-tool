import { Command, Flags } from '@oclif/core'

export abstract class BaseCommand<T = unknown> extends Command {
  static baseFlags = {
    json: Flags.boolean({
      description: 'Format output as json.',
      default: false,
    }),
  }

  // Subclasses return structured data; B3 gives each its concrete type.
  protected abstract runCommand(): Promise<T>

  // Stub run(): B2 replaces this with CommandResult envelope + stderr/stdout split,
  // chalk-suppression, prompt rejection, and typed error classifier.
  public async run(): Promise<void> {
    try {
      const result = await this.runCommand()
      this.log(JSON.stringify(result))
    } catch (error) {
      throw error
    }
  }
}
