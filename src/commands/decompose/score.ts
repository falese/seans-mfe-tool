/**
 * decompose:score — grade a decomposition against an answer key (#415).
 *
 * Scores file → domain assignment (domains matched by shared files, so names
 * do not count), backends per domain, slot structure, test triage and gap
 * detection. When the deterministic draft (proposal.base.yaml) is beside the
 * proposal, it is scored too and the agent's edits are listed — so it is
 * clear which half earned the result.
 *
 * --corpus writes the run as one training record (PDR-009): the evidence, the
 * draft, the agent's edits, the edited proposal, the answer key and both
 * scores.
 */

import { createHash } from 'crypto';
import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { readDecomposition } from '@seans-mfe/decompose';
import { readAnswerKey } from '../../decompose/propose/io';
import { diffProposals, scoreProposal, type Score } from '../../decompose/propose/score';
import { stableStringify } from '../../decompose/bundle';
import type { DecomposeScoreResult } from '../../oclif/results';

const line = (label: string, s: Score) =>
  `  ${label.padEnd(10)} assignment F1 ${s.assignment.f1.toFixed(3)} (${s.assignment.correct}/${s.assignment.total})` +
  `  backends ${s.backends.mean.toFixed(3)}  slots ${s.slots.score.toFixed(3)}  tests ${s.tests.score.toFixed(3)}  gaps ${s.gaps.recall.toFixed(3)}`;

export default class DecomposeScore extends BaseCommand<DecomposeScoreResult> {
  static hidden = true; // plumbing for agents and scripts: out of --help, still an MCP tool (#454)
  static description =
    'Score a decomposition.yaml against an answer key — file assignment F1, backends, slot structure, test ' +
    'triage and gap detection — alongside its deterministic draft, and optionally write a training-corpus record.';

  static args = {
    proposal: Args.string({ description: 'The decomposition.yaml to score', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:score ./evidence/proposal/decomposition.yaml --answer-key examples/meridian-monolith/answer-key.yaml',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    'answer-key': Flags.string({ description: 'The answer key to score against', required: true }),
    base: Flags.string({ description: 'The deterministic draft (default: proposal.base.yaml beside the proposal)' }),
    corpus: Flags.string({ description: 'Directory to write a training-corpus record into' }),
    evidence: Flags.string({ description: 'The evidence bundle the proposal came from, recorded in the corpus record' }),
  };

  protected async runCommand(): Promise<DecomposeScoreResult> {
    const { args, flags } = await this.parse(DecomposeScore);
    const proposalPath = path.resolve(args.proposal);
    const keyPath = path.resolve(flags['answer-key']);
    const doc = await readDecomposition(proposalPath);
    const key = await readAnswerKey(keyPath);
    const score = scoreProposal(doc, key);

    const basePath = path.resolve(flags.base ?? path.join(path.dirname(proposalPath), 'proposal.base.yaml'));
    const baseDoc = (await fs.pathExists(basePath)) ? await readDecomposition(basePath) : null;
    const base = baseDoc ? scoreProposal(baseDoc, key) : null;
    const edits = baseDoc ? diffProposals(baseDoc, doc) : [];

    this.log('');
    if (base) this.log(line('clustering', base));
    this.log(line(base ? '+ agent' : 'proposal', score));
    if (base) this.log(chalk.gray(`  ${edits.length} edit(s) from the draft`));
    for (const m of score.assignment.misplaced) this.log(chalk.yellow(`  misplaced: ${m.file} — ${m.proposed}, expected ${m.expected}`));

    let corpusRecord: string | null = null;
    if (flags.corpus) {
      const evidence = flags.evidence ? path.resolve(flags.evidence) : null;
      const bundleJson = evidence && (await fs.pathExists(path.join(evidence, 'bundle.json'))) ? await fs.readFile(path.join(evidence, 'bundle.json'), 'utf8') : null;
      const record = {
        format: 'smt-decompose-corpus/1',
        evidence: evidence ? { dir: evidence, bundleSha256: bundleJson ? createHash('sha256').update(bundleJson).digest('hex') : null } : null,
        base: baseDoc,
        edits,
        proposal: doc,
        answerKey: keyPath,
        scores: { base, proposal: score },
      };
      const body = stableStringify(record);
      const id = createHash('sha256').update(body).digest('hex').slice(0, 16);
      await fs.ensureDir(path.resolve(flags.corpus));
      corpusRecord = path.join(path.resolve(flags.corpus), `${id}.json`);
      await fs.writeFile(corpusRecord, body);
      this.log(chalk.gray(`  corpus  ${corpusRecord}`));
    }
    this.log('');

    return {
      proposal: proposalPath,
      answerKey: keyPath,
      score,
      base,
      edits: edits.map((e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, String(v)]))),
      corpusRecord,
    };
  }
}
