/**
 * test:generate — generate an MFE's tests from what a running app was observed
 * to do (PDR-014, ADR-129).
 *
 * From an evidence bundle (decompose:capture, ADR-109) it writes, into each
 * MFE: per-capability characterization tests that run alone in jsdom, a
 * Playwright journey spec with per-capability visual baselines, provider and
 * connector contract tests for its BFF, and — for a decomposition — the
 * monolith's tests triaged keep, moved with their code. All developer-owned;
 * a re-run never replaces a file you changed.
 */

import * as os from 'os';
import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { writeProvenance } from '@seans-mfe/flow';
import { BaseCommand } from '../../oclif/BaseCommand';
import { readJourneysFile } from '../../decompose/journeys';
import { generateFleetTests, generateTests, type GeneratedMfeTests } from '../../testgen/generate';
import { crawlToFile, parseViewport, recordJourneys } from '../../testgen/record';
import { HOST_PORT, withHost } from '../../testgen/host';
import type { TestGenerateResult } from '../../oclif/results';

export default class TestGenerate extends BaseCommand<TestGenerateResult> {
  static description =
    'Generate an MFE\'s tests from an evidence bundle of the running app: each capability alone in jsdom, every journey in ' +
    'Playwright with per-capability visual baselines, and contract tests for its BFF (ADR-129).';

  static args = {
    target: Args.string({ description: 'An MFE directory, or with --proposal a decomposition\'s proposal directory (every MFE of its fleet)', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool test:generate ./my-mfe --url http://localhost:5008 --upstream',
    '$ seans-mfe-tool test:generate ./meridian-cargo-ops --host --remote http://localhost:5004 --upstream',
    '$ seans-mfe-tool test:generate ./my-mfe --evidence ./evidence',
    '$ seans-mfe-tool test:generate ./evidence/proposal --proposal',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    evidence: Flags.string({ description: 'The evidence bundle (default with --proposal: the bundle holding the proposal)', exclusive: ['url', 'host'] }),
    host: Flags.boolean({
      description: 'Record the MFE through the capability host: each capability mounted by the platform, as a shell mounts it, in any framework (ADR-129 §13)',
      default: false,
      exclusive: ['url'],
    }),
    remote: Flags.string({ description: 'With --host, the origin the MFE is served from (default: its manifest\'s remoteEntry)' }),
    port: Flags.integer({ description: 'With --host, the port to serve the host on: the journey spec replays against test:host there', default: HOST_PORT }),
    url: Flags.string({
      description: 'Record the MFE running here: its journey file is driven and the tests generated from what it did. With no journey file, the MFE is crawled first and one written',
    }),
    journeys: Flags.string({ description: 'With --url, the journey file to record (default: <mfe>/journeys.yaml)' }),
    'record-to': Flags.string({ description: 'With --url, keep the recording (an evidence bundle) here (default: a temporary directory)' }),
    clock: Flags.string({ description: 'With --url, freeze the page clock at this ISO-8601 time (default: now, to the minute)' }),
    viewport: Flags.string({ description: 'With --url, the viewport as WxH', default: '1440x900' }),
    proposal: Flags.boolean({ description: 'TARGET is a proposal directory: generate for every MFE of its scaffolded fleet', default: false }),
    fleet: Flags.string({ description: 'With --proposal, the fleet (default: what decompose:scaffold recorded)' }),
    'app-dir': Flags.string({ description: 'The monolith\'s source, for moving its kept tests (default: what decompose:analyze recorded)' }),
    force: Flags.boolean({ char: 'f', description: 'Replace generated files a developer has changed', default: false }),
    upstream: Flags.boolean({
      description: 'Record each BFF spec operation the capture has no response for from its server, for the contract tests (an MFE read through its BFF shows the browser only the BFF)',
      default: false,
    }),
  };

  /**
   * ADR-129 §9: the journey file is the source. Record it against the running MFE;
   * with none, crawl the MFE and write one first.
   */
  private async record(mfeDir: string, url: string, o: { journeys?: string; recordTo?: string; clock?: string; viewport: string }): Promise<string> {
    if (!/^https?:\/\//.test(url)) throw new ValidationError(`--url must be http(s), got "${url}"`, 'url', 'absolute-url');
    const viewport = parseViewport(o.viewport);
    const file = path.resolve(o.journeys ?? path.join(mfeDir, 'journeys.yaml'));
    if (!(await fs.pathExists(file))) {
      if (o.journeys) throw new ValidationError(`--journeys ${o.journeys}: no such file`, 'journeys', 'file');
      this.log(chalk.blue(`  no journey file — crawling ${url}`));
      const crawled = await crawlToFile({ url, out: file, maxInteractions: 100, viewport, settleMs: 300 });
      this.log(`  ✓ crawled ${crawled.states} state(s), ${crawled.interactions} interaction(s) → ${path.relative(process.cwd(), file)}`);
      if (crawled.truncated) this.warnings.push('the crawl stopped at 100 interactions; run test:crawl --max to go further');
    }
    const clock = o.clock ?? new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    if (Number.isNaN(Date.parse(clock))) throw new ValidationError(`--clock is not a date: "${clock}"`, 'clock', 'iso-8601');
    const outDir = path.resolve(o.recordTo ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'smt-record-'))));
    const journeys = await readJourneysFile(file);
    this.log(chalk.blue(`  recording ${journeys.length} journey(s) from ${path.relative(process.cwd(), file)} against ${url}`));
    await recordJourneys({ url, journeys, outDir, viewport, clock, settleMs: 500 });
    return outDir;
  }

  protected async runCommand(): Promise<TestGenerateResult> {
    const { args, flags } = await this.parse(TestGenerate);
    const target = path.resolve(args.target);
    let results: GeneratedMfeTests[];
    let evidence: string;
    if (flags.proposal) {
      evidence = path.resolve(flags.evidence ?? path.join(target, '..'));
      results = await generateFleetTests({ proposalDir: target, evidenceDir: evidence, fleetDir: flags.fleet, appDir: flags['app-dir'], force: flags.force, upstream: flags.upstream });
      // Which proposal and capture the fleet's tests were generated from, by content (ADR-119).
      const marker = path.join(target, 'tests.json');
      await fs.writeJson(marker, { mfes: results.map((r) => r.mfe) }, { spaces: 2 });
      await writeProvenance(marker, [path.join(target, 'decomposition.yaml'), path.join(evidence, 'requests.json')]);
    } else if (flags.url || flags.host) {
      const record = (url: string) =>
        this.record(target, url, {
        journeys: flags.journeys,
        recordTo: flags['record-to'],
        clock: flags.clock,
          viewport: flags.viewport,
        });
      evidence = flags.host ? await withHost(target, { remote: flags.remote, port: flags.port }, (url) => record(url)) : await record(flags.url as string);
      results = [await generateTests({ mfeDir: target, evidenceDir: evidence, appDir: flags['app-dir'], force: flags.force, upstream: flags.upstream })];
      if (!flags['record-to']) await fs.remove(evidence);
    } else {
      if (!flags.evidence) throw new ValidationError('pass --url to record the running MFE, or --evidence with an existing recording', 'evidence', 'required');
      evidence = path.resolve(flags.evidence);
      results = [await generateTests({ mfeDir: target, evidenceDir: evidence, appDir: flags['app-dir'], force: flags.force, upstream: flags.upstream })];
    }

    for (const r of results) {
      const cases = r.alone.reduce((n, a) => n + a.cases, 0);
      this.log(
        `  ${chalk.green('✓')} ${r.mfe}  alone ${r.alone.length} capabilities / ${cases} states · journeys ${r.journeys.journeys} / ${r.journeys.checks} checks / ${r.journeys.baselines} baselines · contract ${r.contract.operations} ops` +
          (r.migrated.kept.length > 0 ? ` · moved ${r.migrated.kept.length}` : '')
      );
      for (const s of r.skipped) this.log(chalk.gray(`      ${s.capability}: ${s.reason}`));
      for (const u of r.contract.unrecorded) this.warnings.push(`${r.mfe}: ${u} has no recording — no contract test`);
      this.warnings.push(...r.warnings.map((w) => `${r.mfe}: ${w}`));
      if (r.removed.length > 0) this.log(chalk.gray(`      removed ${r.removed.length} file(s) no longer generated`));
      for (const k of r.kept) this.warnings.push(`${r.mfe}: ${k} was changed since it was generated — kept (--force replaces it)`);
    }
    const e2e = flags.host ? `seans-mfe-tool test:host ${args.target} --port ${flags.port} & npm run test:e2e` : 'SMT_TARGET_URL=<the captured app> npm run test:e2e';
    this.log(chalk.gray(`\n  next: in each MFE, npm test; npm run test:contract; ${e2e} — then any shell it composes into\n`));
    return {
      evidence,
      mfes: results.map(({ mfe, dir, alone, skipped, journeys, contract, migrated, written, kept, removed, warnings, report }) => ({ mfe, dir, alone, skipped, journeys, contract, migrated, written, kept, removed, warnings, report })),
    };
  }
}
