/**
 * test:generate — generate an MFE's tests from what a running app was observed
 * to do (PDR-014, ADR-129).
 *
 * From an evidence bundle (decompose:capture, ADR-109) it writes, into each
 * MFE: per-capability characterization tests that run alone in jsdom, a
 * Playwright journey spec with per-capability visual baselines, provider and
 * connector contract tests for its BFF, and — for a decomposition — the
 * monolith's tests triaged keep, moved with their code. All developer-owned;
 * a re-run never replaces a file you changed.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { writeProvenance } from '@seans-mfe/flow';
import { BaseCommand } from '../../oclif/BaseCommand';
import { generateFleetTests, generateTests, type GeneratedMfeTests } from '../../testgen/generate';
import type { TestGenerateResult } from '../../oclif/results';

export default class TestGenerate extends BaseCommand<TestGenerateResult> {
  static description =
    'Generate an MFE\'s tests from an evidence bundle of the running app: each capability alone in jsdom, every journey in ' +
    'Playwright with per-capability visual baselines, and contract tests for its BFF (ADR-129).';

  static args = {
    target: Args.string({ description: 'An MFE directory, or with --proposal a decomposition\'s proposal directory (every MFE of its fleet)', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool test:generate ./my-mfe --evidence ./evidence',
    '$ seans-mfe-tool test:generate ./evidence/proposal --proposal',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    evidence: Flags.string({ description: 'The evidence bundle (default with --proposal: the bundle holding the proposal)' }),
    proposal: Flags.boolean({ description: 'TARGET is a proposal directory: generate for every MFE of its scaffolded fleet', default: false }),
    fleet: Flags.string({ description: 'With --proposal, the fleet (default: what decompose:scaffold recorded)' }),
    'app-dir': Flags.string({ description: 'The monolith\'s source, for moving its kept tests (default: what decompose:analyze recorded)' }),
    force: Flags.boolean({ char: 'f', description: 'Replace generated files a developer has changed', default: false }),
  };

  protected async runCommand(): Promise<TestGenerateResult> {
    const { args, flags } = await this.parse(TestGenerate);
    const target = path.resolve(args.target);
    let results: GeneratedMfeTests[];
    let evidence: string;
    if (flags.proposal) {
      evidence = path.resolve(flags.evidence ?? path.join(target, '..'));
      results = await generateFleetTests({ proposalDir: target, evidenceDir: evidence, fleetDir: flags.fleet, appDir: flags['app-dir'], force: flags.force });
      // Which proposal and capture the fleet's tests were generated from, by content (ADR-119).
      const marker = path.join(target, 'tests.json');
      await fs.writeJson(marker, { mfes: results.map((r) => r.mfe) }, { spaces: 2 });
      await writeProvenance(marker, [path.join(target, 'decomposition.yaml'), path.join(evidence, 'requests.json')]);
    } else {
      if (!flags.evidence) throw new ValidationError('--evidence is required for a single MFE', 'evidence', 'required');
      evidence = path.resolve(flags.evidence);
      results = [await generateTests({ mfeDir: target, evidenceDir: evidence, appDir: flags['app-dir'], force: flags.force })];
    }

    for (const r of results) {
      const cases = r.alone.reduce((n, a) => n + a.cases, 0);
      this.log(
        `  ${chalk.green('✓')} ${r.mfe}  alone ${r.alone.length} capabilities / ${cases} states · journeys ${r.journeys.journeys} / ${r.journeys.checks} checks / ${r.journeys.baselines} baselines · contract ${r.contract.operations} ops` +
          (r.migrated.kept.length > 0 ? ` · moved ${r.migrated.kept.length}` : '')
      );
      for (const s of r.skipped) this.log(chalk.gray(`      ${s.capability}: ${s.reason}`));
      for (const u of r.contract.unrecorded) this.warnings.push(`${r.mfe}: ${u} has no recording — no contract test`);
      for (const k of r.kept) this.warnings.push(`${r.mfe}: ${k} was changed since it was generated — kept (--force replaces it)`);
    }
    this.log(chalk.gray('\n  next: in each MFE, npm test; npm run test:e2e against the monolith, then the composed shell (SMT_TARGET_URL)\n'));
    return { evidence, mfes: results.map(({ mfe, dir, alone, skipped, journeys, contract, migrated, written, kept, report }) => ({ mfe, dir, alone, skipped, journeys, contract, migrated, written, kept, report })) };
  }
}
