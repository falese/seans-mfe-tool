/**
 * test:crawl — crawl a running MFE and write its journey file (ADR-129 §9).
 *
 * Every interactive control in every state reached from the start becomes one
 * journey in the journey DSL. The file is the source of the MFE's UI tests:
 * edit it, then `test:generate --url` records it and writes the tests.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { crawlToFile, parseViewport } from '../../testgen/record';
import { HOST_PORT, withHost } from '../../testgen/host';
import type { TestCrawlResult } from '../../oclif/results';

export default class TestCrawl extends BaseCommand<TestCrawlResult> {
  static description =
    'Crawl a running MFE and write a journey file: every interactive control in every state reached from the start, ' +
    'one replayable journey per interaction (ADR-129). test:generate --url records it into tests.';

  static args = {
    url: Args.string({ description: 'The running MFE (its standalone page); omit with --host', required: false }),
  };

  static examples = [
    '$ seans-mfe-tool test:crawl http://localhost:5008 --out ./meridian-arrivals/journeys.yaml',
    '$ seans-mfe-tool test:crawl http://localhost:5008 --exclude "log out|delete" --max 200',
    '$ seans-mfe-tool test:crawl --host ./meridian-cargo-ops --remote http://localhost:5004',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    out: Flags.string({ description: 'The journey file to write (default: ./journeys.yaml, or <mfe>/journeys.yaml with --host)' }),
    host: Flags.string({ description: 'Crawl this MFE directory through the capability host: each capability mounted by the platform, in any framework (ADR-129 §13)' }),
    remote: Flags.string({ description: 'With --host, the origin the MFE is served from (default: its manifest\'s remoteEntry)', dependsOn: ['host'] }),
    port: Flags.integer({ description: 'With --host, the port to serve the host on', default: HOST_PORT }),
    max: Flags.integer({ description: 'At most this many interactions', default: 100, min: 1 }),
    exclude: Flags.string({ description: 'Never perform a control whose accessible name matches this pattern (case-insensitive)' }),
    viewport: Flags.string({ description: 'Viewport as WxH', default: '1440x900' }),
    settle: Flags.integer({ description: 'Milliseconds to wait after the network is quiet before reading a state', default: 300 }),
  };

  protected async runCommand(): Promise<TestCrawlResult> {
    const { args, flags } = await this.parse(TestCrawl);
    if (args.url && flags.host) throw new ValidationError('pass a url or --host, not both', 'url', 'one-of');
    if (!args.url && !flags.host) throw new ValidationError('pass the running MFE\'s url, or --host <mfe directory>', 'url', 'required');
    if (args.url && !/^https?:\/\//.test(args.url)) throw new ValidationError(`url must be http(s), got "${args.url}"`, 'url', 'absolute-url');
    const out = path.resolve(flags.out ?? (flags.host ? path.join(flags.host, 'journeys.yaml') : './journeys.yaml'));
    const crawl = (url: string) =>
      crawlToFile({
        url,
        out,
        maxInteractions: flags.max,
        exclude: flags.exclude ? new RegExp(flags.exclude, 'i') : undefined,
        viewport: parseViewport(flags.viewport),
        settleMs: flags.settle,
      }).then((result) => ({ url, result }));
    const { url, result } = flags.host ? await withHost(path.resolve(flags.host), { remote: flags.remote, port: flags.port }, crawl) : await crawl(args.url as string);
    if (result.truncated) this.warnings.push(`stopped at --max ${flags.max}: some controls were not tried`);
    this.log(chalk.green(`  ✓ ${result.states} state(s), ${result.interactions} interaction(s) → ${result.journeys.length} journey(s)`));
    this.log(`  journeys  ${out}\n`);
    return { url, out, states: result.states, interactions: result.interactions, journeys: result.journeys.length, truncated: result.truncated };
  }
}
