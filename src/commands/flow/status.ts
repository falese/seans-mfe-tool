/**
 * flow:status — where a directory stands in an SMT flow (PDR-012, ADR-119).
 *
 * Every step's state is derived from the files on disk: done, stale (something
 * it follows changed after it), waiting on a person, blocked, or not built yet.
 * It names the next command with its arguments filled in from what earlier
 * steps recorded. It runs nothing and writes nothing.
 */

import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { FLOW_IDS, proposalStatusOf, statusOf } from '../../flow';
import type { FlowStatusResult } from '../../oclif/results';

/** Built when rendering, so it follows the colour setting the command runs with. */
const mark = (state: FlowStatusResult['steps'][number]['state']): string =>
  ({
    done: () => chalk.green('✓'),
    stale: () => chalk.yellow('↻'),
    next: () => chalk.cyan('→'),
    ready: () => chalk.cyan('·'),
    waiting: () => chalk.blue('⏸'),
    blocked: () => chalk.dim('·'),
    optional: () => chalk.dim('○'),
    unavailable: () => chalk.dim('✗'),
  })[state]();

export default class FlowStatus extends BaseCommand<FlowStatusResult> {
  static description =
    'Show where a directory stands in an SMT flow — which steps are done, stale or waiting on a person — and the ' +
    'next command to run, with its arguments filled in (PDR-012).';

  static args = {
    dir: Args.string({ description: "The flow's directory (for decompose: the evidence bundle)", default: '.' }),
  };

  static examples = [
    '$ seans-mfe-tool flow:status ./evidence',
    '$ seans-mfe-tool flow:status ./evidence --flow decompose --json',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    flow: Flags.string({ description: `The flow (${FLOW_IDS.join(', ')}); may be left out while there is only one` }),
    proposal: Flags.boolean({
      description:
        "Also report the bundle's proposal as the workspace shows it: the document, validation, approval, each pending " +
        'suggestion checked, and the captured screens (ADR-116 §3). Runs the checks, so it is slower',
      default: false,
    }),
  };

  protected async runCommand(): Promise<FlowStatusResult> {
    const { args, flags } = await this.parse(FlowStatus);
    const id = flags.flow ?? (FLOW_IDS.length === 1 ? FLOW_IDS[0] : undefined);
    if (!id) throw new ValidationError(`name the flow with --flow (${FLOW_IDS.join(', ')})`, 'flow', FLOW_IDS.join('|'));
    const status: FlowStatusResult = statusOf(id, args.dir);
    if (flags.proposal) {
      const found = await proposalStatusOf(status.root);
      if (found) {
        status.proposal = found.status;
        this.warnings.push(...found.warnings);
      } else {
        this.warnings.push('--proposal: the bundle has no proposal/decomposition.yaml yet');
      }
    }

    this.log(`\n  ${chalk.bold(status.title)}  ${chalk.dim(status.root)}\n`);
    for (const s of status.steps) {
      this.log(`  ${mark(s.state)} ${s.title}${s.detail ? chalk.dim(` — ${s.detail}`) : ''}`);
    }
    if (status.next) {
      this.log(`\n  next: ${chalk.cyan(status.next.command)}`);
      if (status.next.placeholders.length > 0) this.log(chalk.yellow(`        fill in ${status.next.placeholders.join(', ')} first`));
    } else {
      this.log(`\n  ${status.summary}`);
    }
    const p = status.proposal;
    if (p) {
      this.log(`\n  ${chalk.bold('proposal')}: ${p.document.domains.map((d) => d.id).join(', ')}`);
      this.log(p.valid ? chalk.green('  ✓ every manifest and the composition validate') : chalk.red('  ✗ validation failed — see proposal.validation in --json'));
      this.log(`  approval: ${p.approval.status}${p.approval.by ? ` (${p.approval.by}, ${p.approval.at})` : ''}`);
      for (const s of p.suggestions) {
        this.log(`  suggestion ${s.id} ${s.check.ok ? chalk.green('✓') : chalk.red('✗')} ${s.edit.kind} — ${s.explanation}`);
      }
      if (p.screens) this.log(`  screens: ${p.screens.screens.length}`);
    }
    this.log('');
    return status;
  }
}
