/**
 * decompose:status — everything the decomposition workspace renders, as one
 * JSON envelope (ADR-116 §3).
 *
 * The document, whether the fleet derived from it validates, the approval and
 * whether it still names the document, each pending suggestion checked by
 * applying it alone (ADR-117 §4), and the captured screens with the proposed
 * domains outlined. It reads and writes nothing else: the workspace API
 * answers its reads from this command, and its writes from decompose:edit.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { readDecomposition, readEvidenceSteps, readSpecs } from '../../decompose/propose/io';
import { proposalStatus } from '../../decompose/propose/status';
import type { DecomposeStatusResult } from '../../oclif/results';

export default class DecomposeStatus extends BaseCommand<DecomposeStatusResult> {
  static description =
    'Report a decomposition proposal as the workspace shows it: the document, validation, approval, each pending ' +
    'suggestion checked, and the captured screens with the proposed domains outlined (ADR-116).';

  static args = {
    proposal: Args.string({ description: 'The proposal directory (holding decomposition.yaml)', required: true }),
  };

  static examples = ['$ seans-mfe-tool decompose:status ./evidence/proposal --json'];

  static flags = {
    ...BaseCommand.baseFlags,
    evidence: Flags.string({ description: "The decompose:capture evidence bundle whose screens to outline (default: the proposal directory's parent, when it is one)" }),
  };

  protected async runCommand(): Promise<DecomposeStatusResult> {
    const { args, flags } = await this.parse(DecomposeStatus);
    const dir = path.resolve(args.proposal);
    const doc = await readDecomposition(path.join(dir, 'decomposition.yaml'));
    const bundle = path.resolve(flags.evidence ?? path.join(dir, '..'));
    const hasBundle = await fs.pathExists(path.join(bundle, 'bundle.json'));
    const evidence = hasBundle
      ? {
          steps: await readEvidenceSteps(bundle),
          viewport: ((await fs.readJson(path.join(bundle, 'bundle.json'))) as { viewport: { width: number; height: number } }).viewport,
        }
      : {};
    if (!hasBundle) this.warnings.push(`${bundle} is not an evidence bundle — no screens to show (pass --evidence)`);
    const status = proposalStatus(doc, { specs: await readSpecs(dir), ...evidence });

    this.log(`\n  ${chalk.bold(doc.app.name)}: ${doc.domains.map((d) => d.id).join(', ')}`);
    this.log(status.valid ? chalk.green('  ✓ every manifest and the composition validate') : chalk.red('  ✗ validation failed — see validation in --json'));
    this.log(`  approval: ${status.approval.status}${status.approval.by ? ` (${status.approval.by}, ${status.approval.at})` : ''}`);
    for (const s of status.suggestions) {
      this.log(`  suggestion ${s.id} ${s.check.ok ? chalk.green('✓') : chalk.red('✗')} ${s.edit.kind} — ${s.explanation}`);
    }
    if (status.screens) this.log(`  screens: ${status.screens.screens.length}`);
    this.log('');

    return { proposal: path.join(dir, 'decomposition.yaml'), bundle: hasBundle ? bundle : null, ...status };
  }
}
