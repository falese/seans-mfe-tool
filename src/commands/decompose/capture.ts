/**
 * decompose:capture — run a monolith and record what it does into an
 * evidence bundle (ADR-109, #413).
 *
 * Drives journeys (a journey file, link-following exploration, or both)
 * against the running app in headless Chromium and records, per step: the
 * regions on screen and the React component and source file behind each,
 * every API request with the source files that sent it and the regions it
 * feeds, navigations, console errors and a screenshot. Every later stage of a
 * decomposition reads the bundle instead of the live app.
 *
 * --replay answers API requests from a previous bundle's recorded responses
 * and reuses its clock and journeys, so two replays write identical JSON.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { buildBundle, readReplaySource, writeBundle, type ReplaySource } from '../../decompose/bundle';
import { captureEvidence } from '../../decompose/capture';
import { parseJourneys, type Journey } from '../../decompose/journeys';
import type { DecomposeCaptureResult } from '../../oclif/results';

function parseViewport(raw: string): { width: number; height: number } {
  const m = raw.match(/^(\d+)x(\d+)$/);
  if (!m) throw new ValidationError(`--viewport must look like 1440x900, got "${raw}"`, 'viewport', 'WxH');
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

export default class DecomposeCapture extends BaseCommand<DecomposeCaptureResult> {
  static description =
    'Run a monolithic web app and record an evidence bundle for decomposition: regions on screen ' +
    'mapped to their React components and source files, API requests attributed to the regions they ' +
    'feed, navigations, console errors and screenshots, per journey step (ADR-109).';

  static args = {
    url: Args.string({ description: 'URL of the running app (a React development build maps regions to source)', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:capture http://localhost:5090',
    '$ seans-mfe-tool decompose:capture http://localhost:5090 --journeys journeys.yaml --explore 0',
    '$ seans-mfe-tool decompose:capture http://localhost:5090 --replay ./evidence --out ./evidence-replay',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    out: Flags.string({ description: 'Directory to write the evidence bundle to', default: './evidence' }),
    journeys: Flags.string({ description: 'Journey file (YAML or JSON) of steps to drive' }),
    explore: Flags.integer({
      description: 'Follow in-app links for up to this many steps as an extra "explore" journey (0 disables)',
      default: 20,
    }),
    replay: Flags.string({
      description: "Answer API requests from this bundle's recorded responses, reusing its clock and journeys",
    }),
    clock: Flags.string({ description: 'Freeze the page clock at this ISO-8601 time (default: now, or the replayed bundle\'s)' }),
    viewport: Flags.string({ description: 'Viewport as WxH', default: '1440x900' }),
    settle: Flags.integer({ description: 'Quiet milliseconds with no request in flight before a step is recorded', default: 500 }),
    'source-root': Flags.string({ description: 'Directory source paths are made relative to (default: cut at /src/)' }),
  };

  protected async runCommand(): Promise<DecomposeCaptureResult> {
    const { args, flags } = await this.parse(DecomposeCapture);
    const url = args.url;
    if (!/^https?:\/\//.test(url)) {
      throw new ValidationError(`url must be http(s), got "${url}"`, 'url', 'absolute-url');
    }

    let replay: ReplaySource | undefined;
    if (flags.replay) {
      const dir = path.resolve(flags.replay);
      if (!(await fs.pathExists(path.join(dir, 'responses.json')))) {
        throw new ValidationError(`--replay ${flags.replay} is not an evidence bundle (no responses.json)`, 'replay', 'bundle');
      }
      replay = await readReplaySource(dir);
    }

    let journeys: Journey[] = [];
    if (flags.journeys) {
      journeys = parseJourneys(await fs.readFile(path.resolve(flags.journeys), 'utf8'));
    } else if (replay) {
      // A replay repeats exactly what ran, the explored steps included.
      journeys = parseJourneys(replay.journeysYaml);
    }
    const explore = replay && !flags.journeys ? 0 : flags.explore;
    if (journeys.length === 0 && explore <= 0) {
      throw new ValidationError('nothing to run: pass --journeys, or --explore greater than 0', 'journeys', 'required');
    }

    const clock = flags.clock ?? replay?.clock ?? new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    if (Number.isNaN(Date.parse(clock))) throw new ValidationError(`--clock is not a date: "${clock}"`, 'clock', 'iso-8601');
    const viewport = parseViewport(flags.viewport);
    const outDir = path.resolve(flags.out);

    this.log(chalk.blue(`\nCapturing ${url} — ${journeys.length} journey(s)${explore > 0 ? `, exploring up to ${explore} steps` : ''}${replay ? ', replaying recorded responses' : ''}\n`));

    const outcome = await captureEvidence({
      url,
      journeys,
      explore,
      viewport,
      clock,
      settleMs: flags.settle,
      replay: replay?.responses,
      sourceRoot: flags['source-root'],
    });
    const bundle = buildBundle(outcome.runs, { appUrl: url, viewport, clock });
    const files = await writeBundle(outDir, bundle);

    const { stats } = bundle;
    const pct = stats.sourceCoverage.visibleElements
      ? Math.round((100 * stats.sourceCoverage.mappedToSource) / stats.sourceCoverage.visibleElements)
      : 0;
    if (stats.sourceCoverage.mappedToSource === 0) {
      this.warnings.push('no region maps to a source file — is this a React development build?');
    }
    if (outcome.replayMisses.length > 0) {
      this.warnings.push(`${outcome.replayMisses.length} request(s) had no recording and were answered 404`);
    }
    this.log(
      chalk.green(
        `  ✓ ${stats.steps} steps, ${stats.regions} regions (${pct}% of visible elements mapped to source), ` +
          `${stats.requests} requests (${stats.attributedRequests} attributed to a region)`
      )
    );
    if (stats.consoleErrors + stats.pageErrors > 0) {
      this.log(chalk.yellow(`  ${stats.consoleErrors} console error(s), ${stats.pageErrors} page error(s) — recorded as the baseline`));
    }
    this.log(`  bundle  ${outDir}\n`);

    return {
      url,
      outDir,
      journeys: outcome.runs.map((r) => r.journey.name),
      mode: replay ? 'replay' : 'live',
      clock,
      stats,
      replayMisses: outcome.replayMisses,
      files,
    };
  }
}
