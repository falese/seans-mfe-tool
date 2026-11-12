/**
 * test:run — every MFE of a composition, its tests run together (ADR-129 §12).
 *
 * Reads the composition (control-plane/rules.json), runs each MFE's own suites in
 * its directory, then — with the shell and its control plane running — fires each
 * action, checks each placement mounts in its slot, and runs each placed
 * capability's pack inside it. One report, every failure attributed to its MFE.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BusinessError, ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { compositionOf, mfeDirs, readPacks, renderRunReport, runMfeSuites, runOk, type MfeRun, type RunReport } from '../../testgen/run';
import { runComposed } from '../../testgen/run-page';
import type { TestRunResult } from '../../oclif/results';

const SUITES = ['unit', 'contract', 'composed'] as const;

export default class TestRun extends BaseCommand<TestRunResult> {
  static description =
    'Run every MFE of a composition\'s tests together: each MFE\'s own suites, then — in the running shell — each action fired, ' +
    'each placement checked in its slot, and each placed capability\'s pack run there (ADR-129).';

  static args = {
    project: Args.string({ description: 'The project: holds control-plane/control-plane.yaml and rules.json', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool test:run examples/meridian-station',
    '$ seans-mfe-tool test:run examples/meridian-station --suites composed --shell-url http://localhost:5000',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    suites: Flags.string({ description: `Comma-separated: ${SUITES.join(', ')}`, default: SUITES.join(',') }),
    'shell-url': Flags.string({ description: 'The running shell, for the composed suite', default: 'http://localhost:5000' }),
    daemon: Flags.string({ description: 'The control plane\'s daemon, which relays actions to the shell', default: 'http://localhost:4504' }),
    mfe: Flags.string({ description: 'Only these MFEs\' own suites (comma-separated manifest names); the composed suite still runs the whole composition' }),
    out: Flags.string({ description: 'Where the report is written (default: <project>/test-results/test-run)' }),
  };

  protected async runCommand(): Promise<TestRunResult> {
    const { args, flags } = await this.parse(TestRun);
    const projectDir = path.resolve(args.project);
    const rulesFile = path.join(projectDir, 'control-plane', 'rules.json');
    if (!(await fs.pathExists(rulesFile))) throw new ValidationError(`${projectDir} has no control-plane/rules.json — compose:build it first`, 'project', 'rules.json');
    const suites = new Set(flags.suites.split(',').map((s) => s.trim()));
    for (const s of suites) if (!(SUITES as readonly string[]).includes(s)) throw new ValidationError(`unknown suite "${s}": one of ${SUITES.join(', ')}`, 'suites', 'one-of');

    const composition = compositionOf((await fs.readJson(rulesFile)) as Parameters<typeof compositionOf>[0]);
    const dirs = await mfeDirs(projectDir);
    const only = flags.mfe ? new Set(flags.mfe.split(',').map((s) => s.trim())) : null;
    const placedMfes = [...new Set(composition.actions.flatMap((a) => a.placements.map((p) => p.mfe)))].sort();

    const mfes: MfeRun[] = [];
    for (const mfe of placedMfes) {
      if (only && !only.has(mfe)) continue;
      const dir = dirs.get(mfe);
      if (!dir) {
        const why = { skipped: 'no MFE directory in the composition’s mfes: list — a second build of another MFE, or another project’s' };
        mfes.push({ mfe, dir: null, unit: why, contract: why });
        continue;
      }
      const run: MfeRun = suites.has('unit') || suites.has('contract') ? await runMfeSuites(mfe, dir, projectDir) : { mfe, dir: path.relative(projectDir, dir), unit: { skipped: 'not asked' }, contract: { skipped: 'not asked' } };
      if (!suites.has('unit')) run.unit = { skipped: 'not asked' };
      if (!suites.has('contract')) run.contract = { skipped: 'not asked' };
      mfes.push(run);
      this.log(`  ${run.mfe}  jest ${'skipped' in run.unit ? run.unit.skipped : `${run.unit.passed} passed, ${run.unit.failed} failed`} · contracts ${'skipped' in run.contract ? run.contract.skipped : `${run.contract.passed} passed, ${run.contract.failed} failed`}`);
    }

    let composed: RunReport['composed'] = { skipped: 'not asked' };
    if (suites.has('composed')) {
      const { packs, responses } = await readPacks(dirs);
      this.log(chalk.blue(`\n  composing ${composition.actions.length} action(s) in ${flags['shell-url']} — ${packs.length} capability pack(s)`));
      composed = await runComposed({ shellUrl: flags['shell-url'], daemonUrl: flags.daemon, composition, packs, responses });
    }

    const partial = { project: path.basename(projectDir), mfes, composed };
    const report: RunReport = { ...partial, ok: runOk(partial) };
    const outDir = path.resolve(flags.out ?? path.join(projectDir, 'test-results', 'test-run'));
    await fs.ensureDir(outDir);
    await fs.writeJson(path.join(outDir, 'report.json'), report, { spaces: 2 });
    const markdown = renderRunReport(report);
    await fs.writeFile(path.join(outDir, 'report.md'), markdown);
    this.log(`\n${markdown}`);
    this.log(`  report  ${path.join(outDir, 'report.md')}\n`);

    const result: TestRunResult = { project: projectDir, ok: report.ok, report: { json: path.join(outDir, 'report.json'), markdown: path.join(outDir, 'report.md') }, summary: report };
    if (!report.ok) throw new BusinessError(`not every test passes — see ${path.relative(process.cwd(), path.join(outDir, 'report.md'))}`, 'TESTS_FAILED', { report: path.join(outDir, 'report.json') });
    return result;
  }
}
