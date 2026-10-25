/**
 * decompose:verify — the parity gate (ADR-113, #418).
 *
 * Drives a candidate app through a baseline bundle's journeys with the
 * baseline's clock and recorded responses, captures it as a second bundle,
 * and compares the two step by step: regions and their text, backend calls,
 * console errors, and each region's pixels. Writes `parity.json` and
 * `parity.md`, and fails when the candidate is not at parity.
 *
 * The baseline is the monolith's capture (ADR-113 §1). Verify the monolith
 * against itself first — that proves the journeys are deterministic (§3) —
 * then point `--url` at the composed app after each strangler step (§6).
 * `--candidate` compares an existing bundle without running a browser.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BusinessError, ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { buildBundle, readReplaySource, stableStringify, writeBundle } from '../../decompose/bundle';
import { captureEvidence } from '../../decompose/capture';
import { parseJourneys } from '../../decompose/journeys';
import type { SourceGraph } from '../../decompose/source/graph';
import { readBundleView, renderParityMarkdown, screenshotReader } from '../../decompose/verify/io';
import { compareBundles, routeGaps } from '../../decompose/verify/parity';
import type { DecomposeVerifyResult } from '../../oclif/results';

export default class DecomposeVerify extends BaseCommand<DecomposeVerifyResult> {
  static description =
    'Run the parity gate: drive an app through a baseline evidence bundle\'s journeys on its recorded data and ' +
    'compare regions, text, backend calls, console errors and pixels step by step (ADR-113).';

  static args = {
    baseline: Args.string({ description: 'The baseline evidence bundle (the monolith\'s decompose:capture)', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:verify ./evidence',
    '$ seans-mfe-tool decompose:verify ./evidence --url http://localhost:4000 --out ./verify/step-3',
    '$ seans-mfe-tool decompose:verify ./evidence --candidate ./other-bundle',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    url: Flags.string({ description: 'The app to verify (default: the app the baseline captured)' }),
    candidate: Flags.string({ description: 'Compare this existing bundle instead of capturing one', exclusive: ['url'] }),
    out: Flags.string({ description: 'Directory for the candidate bundle and the report (default: <baseline>/../verify)' }),
    'pixel-tolerance': Flags.integer({ description: 'Per-channel difference (0–255) a pixel may have before it counts as changed', default: 4, min: 0, max: 255 }),
    'max-diff-pixels': Flags.integer({ description: 'Pixels a region may have changed before it fails (as toHaveScreenshot)', default: 0, min: 0 }),
    settle: Flags.integer({ description: 'Quiet milliseconds with no request in flight before a step is recorded', default: 500 }),
    'source-root': Flags.string({ description: 'Directory source paths are made relative to (default: cut at /src/)' }),
  };

  protected async runCommand(): Promise<DecomposeVerifyResult> {
    const { args, flags } = await this.parse(DecomposeVerify);
    const baselineDir = path.resolve(args.baseline);
    const baseline = await readBundleView(baselineDir);
    const outDir = path.resolve(flags.out ?? path.join(baselineDir, '..', 'verify'));
    if (outDir === baselineDir) throw new ValidationError('--out must not be the baseline bundle', 'out', 'distinct');

    let candidateDir: string;
    let url: string | null = null;
    let replayMisses: string[] = [];
    if (flags.candidate) {
      candidateDir = path.resolve(flags.candidate);
    } else {
      url = flags.url ?? baseline.app;
      if (!/^https?:\/\//.test(url)) throw new ValidationError(`url must be http(s), got "${url}"`, 'url', 'absolute-url');
      const replay = await readReplaySource(baselineDir);
      const meta = (await fs.readJson(path.join(baselineDir, 'bundle.json'))) as { viewport: { width: number; height: number } };
      this.log(chalk.blue(`\nVerifying ${url} against ${baselineDir}\n`));
      const outcome = await captureEvidence({
        url,
        journeys: parseJourneys(replay.journeysYaml),
        explore: 0,
        viewport: meta.viewport,
        clock: replay.clock,
        settleMs: flags.settle,
        replay: replay.responses,
        sourceRoot: flags['source-root'],
      });
      replayMisses = outcome.replayMisses;
      candidateDir = path.join(outDir, 'candidate');
      await writeBundle(candidateDir, buildBundle(outcome.runs, { appUrl: url, viewport: meta.viewport, clock: replay.clock }));
    }

    const candidate = await readBundleView(candidateDir);
    const report = compareBundles(baseline, candidate, { screenshot: screenshotReader(baselineDir, candidateDir), maxDiffPixels: flags['max-diff-pixels'], pixelTolerance: flags['pixel-tolerance'] });
    const graphFile = path.join(baselineDir, 'source', 'graph.json');
    const routes = (await fs.pathExists(graphFile)) ? ((await fs.readJson(graphFile)) as SourceGraph).routes.map((r) => r.path) : [];
    const gaps = { routes: routeGaps(routes, baseline.journeys.flatMap((j) => j.steps.map((s) => s.path))) };

    await fs.ensureDir(outDir);
    const reportJson = path.join(outDir, 'parity.json');
    const reportMd = path.join(outDir, 'parity.md');
    await fs.writeFile(reportJson, stableStringify({ baseline: baselineDir, candidate: candidateDir, ...report, gaps }));
    await fs.writeFile(reportMd, renderParityMarkdown(report, gaps));

    const s = report.summary;
    const failingSteps = report.journeys.flatMap((j) => j.steps.filter((st) => !st.ok).map((st) => st.id));
    this.log(
      `  ${s.stepsAtParity}/${s.steps} steps at parity · ${s.regionsAtParity}/${s.regions} regions · ` +
        `${s.newConsoleErrors} new console error(s) · ${s.visualFailures} visual failure(s)`
    );
    for (const id of failingSteps) this.log(chalk.red(`  ✗ ${id}`));
    if (gaps.routes.length > 0) this.log(chalk.yellow(`  not exercised: ${gaps.routes.join(', ')}`));
    if (replayMisses.length > 0) this.warnings.push(`${replayMisses.length} request(s) had no recording and were answered 404`);
    this.log(report.parity ? chalk.green('  ✓ at parity') : chalk.red('  ✗ not at parity'));
    this.log(`  report  ${reportMd}\n`);

    const result: DecomposeVerifyResult = {
      baseline: baselineDir,
      candidate: candidateDir,
      url,
      parity: report.parity,
      summary: s,
      failingSteps,
      gaps,
      replayMisses,
      report: { json: reportJson, markdown: reportMd },
    };
    if (!report.parity) {
      throw new BusinessError(`not at parity: ${failingSteps.length} of ${s.steps} step(s) differ — see ${path.relative(process.cwd(), reportMd)}`, 'PARITY_FAILED', {
        report: reportJson,
        failingSteps,
        summary: s,
      });
    }
    return result;
  }
}
