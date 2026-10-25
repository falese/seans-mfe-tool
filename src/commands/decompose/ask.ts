/**
 * decompose:ask — ask the agent to change a proposal, in plain language
 * (ADR-117, ADR-118 §3).
 *
 * The request and the proposal go to a hosted model through the coder seam's
 * `api` transport and `decomposition-edit` prompt adaptor. Each edit it answers
 * with is dry-applied and the derived fleet validated; the ones that pass are
 * written as pending suggestions, beside the question and the answer. Nothing
 * else changes until a person accepts a suggestion (ADR-116 §4).
 */

import * as os from 'os';
import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { askAgent } from '@seans-mfe/decompose';
import { anthropicClient, decompositionEditModel, DEFAULT_API_MODEL } from '@seans-mfe/plugin-coder';
import { BaseCommand } from '../../oclif/BaseCommand';
import type { DecomposeAskResult } from '../../oclif/results';

export default class DecomposeAsk extends BaseCommand<DecomposeAskResult> {
  static description =
    'Ask the agent to change a decomposition proposal, or a question about it; its edits are checked and written as ' +
    'suggestions for a person to accept or reject (ADR-117). Needs ANTHROPIC_API_KEY.';

  static args = {
    proposal: Args.string({ description: 'The proposal directory (holding decomposition.yaml)', required: true }),
    request: Args.string({ description: 'What to change, or a question about the proposal', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:ask ./evidence/proposal "Split hazards out of cargo — they are a separate team"',
    '$ seans-mfe-tool decompose:ask ./evidence/proposal "Why is constants.ts shared?" --by "Pat Lee" --json',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    by: Flags.string({ description: 'Who is asking; signs the question in the proposal’s conversation (default: your user name)' }),
    model: Flags.string({ description: 'The model to ask', default: DEFAULT_API_MODEL }),
  };

  protected async runCommand(): Promise<DecomposeAskResult> {
    const { args, flags } = await this.parse(DecomposeAsk);
    const model = decompositionEditModel({ client: anthropicClient(), model: flags.model });
    const result = await askAgent(
      path.resolve(args.proposal),
      { request: args.request, by: flags.by ?? os.userInfo().username, at: new Date().toISOString() },
      model
    );

    this.log(`\n${result.answer}\n`);
    for (const s of result.suggested) this.log(`  ${chalk.green('suggested')} ${chalk.cyan(s.edit.kind)} — ${s.explanation}`);
    for (const d of result.dropped) this.log(`  ${chalk.yellow('dropped')}   ${chalk.cyan(d.edit.kind)} — ${d.reason}`);
    this.log(chalk.dim(`\n  answered by ${result.model}; accept or reject in the workspace, or with decompose:edit\n`));
    return result;
  }
}
