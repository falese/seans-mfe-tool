/**
 * compose:build — compile a project's composition into the registry payload (ADR-083).
 *
 * `rules.json` stops being a source file and becomes generated output, held to
 * the same rule as every other generated artifact: never hand-edited,
 * regenerated from its source. The source is `control-plane.yaml` plus the
 * fleet's manifests.
 */

import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as path from 'path';
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { BusinessError } from '@seans-mfe/contracts';
import type { ControlPlaneFinding } from '@seans-mfe/dsl';
import { loadComposition, renderPayload } from './_shared';

interface ControlPlaneBuildResult {
  documentPath: string;
  payloadPath: string;
  project: string;
  namespace: string;
  mfes: number;
  routes: number;
  findings: ControlPlaneFinding[];
  /** False when --dry-run, or when the payload was already current. */
  written: boolean;
  changed: boolean;
  ok: boolean;
}

export default class ControlPlaneBuild extends BaseCommand<ControlPlaneBuildResult> {
  static description = "Compile a project's control-plane.yaml into the registry rules payload";

  static examples = [
    '$ seans-mfe-tool compose:build examples/meridian-station',
    '$ seans-mfe-tool compose:build examples/abc-kids --dry-run',
    '$ seans-mfe-tool compose:build . --json',
  ];

  static args = {
    project: Args.string({
      description:
        'Project directory, its control-plane/ directory, or the control-plane.yaml itself',
      default: '.',
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    'dry-run': Flags.boolean({
      description: 'Compile and report without writing the payload',
      default: false,
    }),
  };

  protected async runCommand(): Promise<ControlPlaneBuildResult> {
    const { args, flags } = await this.parse(ControlPlaneBuild);

    const { documentPath, payloadPath, document, payload, findings } = await loadComposition(
      args.project
    );

    const fatal = findings.filter((f) => f.fatal);
    const rendered = renderPayload(payload);
    const existing = (await fs.pathExists(payloadPath))
      ? await fs.readFile(payloadPath, 'utf8')
      : null;
    const changed = existing !== rendered;

    // Never write a payload built from a document with fatal findings — a
    // half-valid rules.json is worse than a stale one, because the registry
    // accepts it and the missing placements simply never appear.
    const written = fatal.length === 0 && changed && !flags['dry-run'];
    if (written) {
      await fs.ensureDir(path.dirname(payloadPath));
      await fs.writeFile(payloadPath, rendered);
    }

    const result: ControlPlaneBuildResult = {
      documentPath,
      payloadPath,
      project: document.project,
      namespace: document.namespace,
      mfes: payload.length,
      routes: payload.reduce((total, entry) => total + entry.routes.length, 0),
      findings,
      written,
      changed,
      ok: fatal.length === 0,
    };

    if (!this.jsonEnabled()) this.report(result, flags['dry-run']);

    if (fatal.length > 0) {
      throw new BusinessError(
        `${fatal.length} composition error(s) in ${path.relative(process.cwd(), documentPath)}`,
        'COMPOSITION_INVALID',
        { documentPath, rules: fatal.map((f) => f.rule) }
      );
    }

    return result;
  }

  private report(result: ControlPlaneBuildResult, dryRun: boolean): void {
    const rel = (p: string): string => path.relative(process.cwd(), p) || p;

    console.log(chalk.blue(`\nCompiling ${rel(result.documentPath)}`));
    console.log(
      `  project ${chalk.bold(result.project)} · namespace ${chalk.bold(result.namespace)} · ` +
        `${result.mfes} MFE(s) · ${result.routes} route(s)`
    );

    for (const finding of result.findings) {
      const label = finding.fatal ? chalk.red('error') : chalk.yellow('warn ');
      console.log(`  ${label} ${chalk.dim(`[${finding.rule}]`)} ${finding.message}`);
    }

    if (!result.ok) return;

    if (dryRun) {
      console.log(
        chalk.yellow(
          `  dry run — ${rel(result.payloadPath)} ${result.changed ? 'would change' : 'is already current'}`
        )
      );
      return;
    }
    console.log(
      result.written
        ? chalk.green(`  wrote ${rel(result.payloadPath)}`)
        : chalk.dim(`  ${rel(result.payloadPath)} already current`)
    );
  }
}
