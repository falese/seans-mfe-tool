/**
 * decompose:workspace — open the decomposition workspace on a proposal (ADR-116).
 *
 * Runs, on this machine only, the workspace API over the proposal, the
 * workspace MFE's own BFF, and one front door that serves the MFE's standalone
 * page. Every change made there is a named edit, applied through
 * `@seans-mfe/decompose` exactly as decompose:edit applies it (ADR-118); an
 * approval is committed to the repository (ADR-116 §5) unless --no-commit.
 * With ANTHROPIC_API_KEY set, the agent pane asks the agent (ADR-117).
 * Stop with Ctrl-C.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { MFE_DIR, buildMfe, startWorkspace, whoIsApproving } from '@seans-mfe/workspace';
import { BaseCommand } from '../../oclif/BaseCommand';
import { agentFor } from '../../decompose/agent';
import type { DecomposeWorkspaceResult } from '../../oclif/results';

export default class DecomposeWorkspace extends BaseCommand<DecomposeWorkspaceResult> {
  static description =
    'Open the decomposition workspace on a proposal: the screens with the proposed domains outlined, merge / split / ' +
    'rename / move, agent suggestions and approval — served on this machine, every change a named edit (ADR-116).';

  static args = {
    proposal: Args.string({ description: 'The proposal directory (holding decomposition.yaml)', required: true }),
  };

  static examples = [
    '<%= config.bin %> decompose:workspace ./evidence/proposal',
    '<%= config.bin %> decompose:workspace ./evidence/proposal --build --who "Pat Lee"',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    evidence: Flags.string({ description: "The decompose:capture evidence bundle to show (default: the proposal directory's parent)" }),
    port: Flags.integer({ description: 'Port for the workspace page', default: 4611 }),
    who: Flags.string({ description: "Name recorded on comments and approvals (default: git's user.name)" }),
    commit: Flags.boolean({ description: 'Commit the proposal when it is approved (ADR-116 §5)', default: true, allowNo: true }),
    agent: Flags.boolean({
      description: 'Connect the agent pane to a hosted model when ANTHROPIC_API_KEY is set (ADR-117)',
      default: true,
      allowNo: true,
    }),
    model: Flags.string({ description: 'The model the agent asks (default: the coder seam’s)' }),
    build: Flags.boolean({ description: 'Install and build the workspace MFE first (needed once, and after an upgrade)', default: false }),
    'exit-after-start': Flags.boolean({ description: 'Start, report where, and stop — for checks and scripts', default: false, hidden: true }),
  };

  protected async runCommand(): Promise<DecomposeWorkspaceResult> {
    const { args, flags } = await this.parse(DecomposeWorkspace);
    const proposal = path.resolve(args.proposal);
    const log = (line: string) => this.log(line);

    const childEnv = this.childTraceEnv();

    if (flags.build) {
      log(chalk.blue('Building the workspace MFE…'));
      await buildMfe(MFE_DIR, log, childEnv);
    }

    const workspace = await startWorkspace({
      proposalDir: proposal,
      evidenceDir: flags.evidence ? path.resolve(flags.evidence) : undefined,
      port: flags.port,
      who: flags.who ?? (await whoIsApproving(proposal)),
      commit: flags.commit,
      log,
      agent: agentFor({ proposalDir: proposal, enabled: flags.agent, model: flags.model, env: process.env }),
      childEnv,
    });

    log(chalk.green(`\n  ✓ Decomposition workspace: ${chalk.bold(workspace.url)}`));
    log(`    proposal  ${proposal}`);
    log(`    api       ${workspace.api}   bff ${workspace.bff}   (this machine only)`);
    log(`    agent     ${workspace.agent}`);
    if (!flags['exit-after-start']) {
      log(chalk.dim('    Ctrl-C to stop\n'));
      await new Promise<void>((resolve) => {
        process.once('SIGINT', () => resolve());
        process.once('SIGTERM', () => resolve());
      });
    }
    await workspace.close();
    return { url: workspace.url, proposal: path.join(proposal, 'decomposition.yaml'), approvals: workspace.approvals };
  }
}
