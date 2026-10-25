/**
 * coder:suggest — ask the agent about a decomposition proposal (ADR-117).
 *
 * The request and the proposal go to a hosted model through the `api`
 * transport and the `decomposition-edit` prompt adaptor. Each edit it answers
 * with is dry-applied and validated; the ones that pass are written to the
 * proposal as pending suggestions, beside the question and the answer. Nothing
 * else changes until a person accepts a suggestion (ADR-116 §4).
 */

import { userInfo } from 'node:os';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '@seans-mfe/oclif-base';
import { anthropicClient, DEFAULT_API_MODEL, runPromptAdaptor } from '../../api-runner';
import { decompositionEdit } from '../../adaptors/decomposition-edit';
import { makeCliRunner } from '../../cli';
import { suggestEdits, type SuggestResult } from '../../suggest';

export default class CoderSuggest extends BaseCommand<SuggestResult> {
  static description =
    'Ask the agent to change a decomposition proposal in plain language; its edits are checked and written as ' +
    'suggestions for a person to accept or reject (ADR-117). Needs ANTHROPIC_API_KEY.';

  static examples = [
    '<%= config.bin %> coder:suggest ./evidence/proposal "Split hazards out of cargo — they are a separate team"',
    '<%= config.bin %> coder:suggest ./evidence/proposal "Why is constants.ts shared?" --by "Pat Lee" --json',
  ];

  static args = {
    proposal: Args.string({ description: 'The proposal directory (holding decomposition.yaml)', required: true }),
    request: Args.string({ description: 'What to change, or a question about the proposal', required: true }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    by: Flags.string({ description: 'Who is asking; signs the question in the proposal’s conversation (default: your user name)' }),
    model: Flags.string({ description: 'The model to ask', default: DEFAULT_API_MODEL }),
  };

  protected async runCommand(): Promise<SuggestResult> {
    const { args, flags } = await this.parse(CoderSuggest);
    const client = anthropicClient();
    const result = await suggestEdits(
      { proposalDir: args.proposal, request: args.request, by: flags.by ?? userInfo().username, at: new Date().toISOString() },
      {
        cli: makeCliRunner([process.execPath, process.argv[1]]),
        ask: (input) => runPromptAdaptor(decompositionEdit, input, { client, model: flags.model }),
      },
    );

    this.log(`\n${result.answer}\n`);
    for (const s of result.suggested) this.log(`  ${chalk.green('suggested')} ${chalk.cyan(s.edit.kind)} — ${s.explanation}`);
    for (const d of result.dropped) this.log(`  ${chalk.yellow('dropped')}   ${chalk.cyan(d.edit.kind)} — ${d.reason}`);
    this.log(chalk.dim(`\n  answered by ${result.model}; accept or reject in the workspace, or with decompose:edit\n`));
    return result;
  }
}
