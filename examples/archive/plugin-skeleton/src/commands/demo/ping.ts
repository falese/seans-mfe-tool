import { Flags } from '@oclif/core';
import { BaseCommand } from '@seans-mfe/oclif-base';
import { ValidationError } from '@seans-mfe/contracts';

export interface PingResult {
  message: string;
  echo?: string;
  timestamp: string;
}

export default class DemoPing extends BaseCommand<PingResult> {
  static description = 'Demo command — replies with a ping/pong message.';

  static examples = [
    '<%= config.bin %> demo:ping',
    '<%= config.bin %> demo:ping --message hello --json',
  ];

  static flags = {
    message: Flags.string({
      char: 'm',
      description: 'Optional message to echo back',
    }),
  };

  async runCommand(): Promise<PingResult> {
    const { flags } = await this.parse(DemoPing);

    if (flags.message !== undefined && flags.message.trim() === '') {
      throw new ValidationError(
        '--message cannot be blank',
        'message',
        'non-empty',
      );
    }

    this.log('pong! 🏓');

    return {
      message: 'pong',
      echo: flags.message,
      timestamp: new Date().toISOString(),
    };
  }
}
