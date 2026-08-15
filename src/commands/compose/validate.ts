/**
 * compose:validate — check a project's composition without writing (ADR-083).
 *
 * Two things it answers that nothing answered before `control-plane.yaml`
 * existed:
 *
 *   - Is the composition itself sound — every capability declared by exactly
 *     one MFE, every slot address provided, every state key inside the
 *     project's namespace?
 *   - Is the committed `rules.json` what the document actually compiles to?
 *     With `--check`, a stale payload fails, the same contract the codegen
 *     drift gate applies to generated MFE files.
 */

import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as path from 'path';
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { BusinessError } from '@seans-mfe/contracts';
import type { ControlPlaneFinding } from '@seans-mfe/dsl';
import { loadComposition, renderPayload } from './_shared';

interface ControlPlaneValidateResult {
  documentPath: string;
  payloadPath: string;
  project: string;
  namespace: string;
  mfes: number;
  routes: number;
  findings: ControlPlaneFinding[];
  /** Only meaningful with --check: whether the committed payload matches the document. */
  payloadCurrent: boolean | null;
  ok: boolean;
}

export default class ControlPlaneValidate extends BaseCommand<ControlPlaneValidateResult> {
  static description = "Validate a project's control-plane.yaml, and optionally its compiled payload";

  static examples = [
    '$ seans-mfe-tool compose:validate examples/meridian-station',
    '$ seans-mfe-tool compose:validate examples/abc-kids --check',
    '$ seans-mfe-tool compose:validate . --json',
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
    check: Flags.boolean({
      description: 'Also fail if the committed rules.json is not what the document compiles to',
      default: false,
    }),
  };

  protected async runCommand(): Promise<ControlPlaneValidateResult> {
    const { args, flags } = await this.parse(ControlPlaneValidate);

    const { documentPath, payloadPath, document, payload, findings } = await loadComposition(
      args.project
    );

    let payloadCurrent: boolean | null = null;
    if (flags.check) {
      const existing = (await fs.pathExists(payloadPath))
        ? await fs.readFile(payloadPath, 'utf8')
        : null;
      payloadCurrent = existing === renderPayload(payload);
    }

    const fatal = findings.filter((f) => f.fatal);
    const result: ControlPlaneValidateResult = {
      documentPath,
      payloadPath,
      project: document.project,
      namespace: document.namespace,
      mfes: payload.length,
      routes: payload.reduce((total, entry) => total + entry.routes.length, 0),
      findings,
      payloadCurrent,
      ok: fatal.length === 0 && payloadCurrent !== false,
    };

    if (!this.jsonEnabled()) this.report(result);

    if (fatal.length > 0) {
      throw new BusinessError(
        `${fatal.length} composition error(s) in ${path.relative(process.cwd(), documentPath)}`,
        'COMPOSITION_INVALID',
        { documentPath, rules: fatal.map((f) => f.rule) }
      );
    }
    if (payloadCurrent === false) {
      throw new BusinessError(
        `${path.relative(process.cwd(), payloadPath)} is stale — run \`compose:build\` and commit the result`,
        'COMPOSITION_PAYLOAD_STALE',
        { payloadPath }
      );
    }

    return result;
  }

  private report(result: ControlPlaneValidateResult): void {
    const rel = (p: string): string => path.relative(process.cwd(), p) || p;

    console.log(chalk.blue(`\nValidating ${rel(result.documentPath)}`));
    console.log(
      `  project ${chalk.bold(result.project)} · namespace ${chalk.bold(result.namespace)} · ` +
        `${result.mfes} MFE(s) · ${result.routes} route(s)`
    );

    for (const finding of result.findings) {
      const label = finding.fatal ? chalk.red('error') : chalk.yellow('warn ');
      console.log(`  ${label} ${chalk.dim(`[${finding.rule}]`)} ${finding.message}`);
    }

    if (result.payloadCurrent === false) {
      console.log(chalk.red(`  error ${rel(result.payloadPath)} is stale`));
    } else if (result.payloadCurrent === true) {
      console.log(chalk.green(`  ${rel(result.payloadPath)} is current`));
    }

    if (result.ok && result.findings.length === 0) {
      console.log(chalk.green('  composition is valid'));
    }
  }
}
