/**
 * test:host — serve an MFE's capability host (ADR-129 §13): each capability mounted by
 * the platform, as a shell mounts it, on a page that can be opened, crawled, recorded,
 * and replayed against, whatever framework the MFE is built in.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { HOST_PORT, withHost } from '../../testgen/host';
import type { TestHostResult } from '../../oclif/results';

export default class TestHost extends BaseCommand<TestHostResult> {
  static description =
    'Serve an MFE\'s capabilities, each mounted by the platform as a shell mounts it, on one page: what test:crawl and ' +
    'test:generate --host record, and its journey spec replays against, in any framework (ADR-129). Runs until interrupted.';

  static args = {
    mfe: Args.string({ description: 'The MFE directory', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool test:host ./meridian-cargo-ops --remote http://localhost:5004',
    '$ seans-mfe-tool test:host ./meridian-cargo-ops & SMT_TARGET_URL=http://localhost:5180 npm run test:e2e',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    remote: Flags.string({ description: 'The origin the MFE is served from (default: its manifest\'s remoteEntry)' }),
    port: Flags.integer({ description: 'The port to serve the host on', default: HOST_PORT }),
  };

  protected async runCommand(): Promise<TestHostResult> {
    const { args, flags } = await this.parse(TestHost);
    return withHost(path.resolve(args.mfe), { remote: flags.remote, port: flags.port }, async (url, target) => {
      this.log(chalk.green(`  ✓ ${target.mfe}: ${target.capabilities.join(', ')}, mounted from ${target.remoteEntryUrl}`));
      this.log(`  host  ${url}   (Ctrl-C to stop)\n`);
      await new Promise<void>((resolve) => {
        process.once('SIGINT', resolve);
        process.once('SIGTERM', resolve);
      });
      return { mfe: target.mfe, url, capabilities: target.capabilities, remoteEntryUrl: target.remoteEntryUrl };
    });
  }
}
