/**
 * decompose:analyze — read a React SPA's source into a source graph and join
 * it to a decompose:capture evidence bundle (ADR-109 §3, #414).
 *
 * The source graph holds routes (with the landmark each renders into), the
 * import graph, components, API endpoints followed through wrapper functions
 * to concrete URLs, store reads resolved to the endpoints that load them, and
 * every source file assigned to the screens that reach it, the app shell, or
 * flagged shared or unreached. It also inventories the app's own tests (and
 * runs them), and reads co-change and CODEOWNERS. With --evidence, observed
 * endpoints are matched to the source that explains them, so runtime and
 * source evidence vote on the same files.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { analysisOutDir } from '../../decompose/source/out-dir';
import { analyzeProject } from '../../decompose/source/analyze';
import type { DecomposeAnalyzeResult } from '../../oclif/results';

export default class DecomposeAnalyze extends BaseCommand<DecomposeAnalyzeResult> {
  static description =
    "Read a React app's source into a source graph — routes, imports, components, API endpoints, store reads, " +
    "each file's screen — inventory and run its tests, read co-change and CODEOWNERS, and join it to a " +
    'decompose:capture evidence bundle (ADR-109).';

  static args = {
    dir: Args.string({ description: "The app's directory (holding package.json and src/)", required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:analyze examples/meridian-monolith --evidence ./evidence',
    '$ seans-mfe-tool decompose:analyze ./app --src source --no-run-tests --out ./analysis',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    evidence: Flags.string({ description: 'A decompose:capture evidence bundle to join with' }),
    out: Flags.string({ description: 'Directory to write to (default: <evidence>/source, or ./evidence/source)' }),
    src: Flags.string({ description: "Source directory inside the app", default: 'src' }),
    'run-tests': Flags.boolean({
      description: "Run the app's Jest suite to record per-test results (needs its dependencies installed)",
      default: true,
      allowNo: true,
    }),
  };

  protected async runCommand(): Promise<DecomposeAnalyzeResult> {
    const { args, flags } = await this.parse(DecomposeAnalyze);
    const dir = path.resolve(args.dir);
    const evidenceDir = flags.evidence ? path.resolve(flags.evidence) : undefined;
    if (evidenceDir && !(await fs.pathExists(path.join(evidenceDir, 'requests.json')))) {
      throw new ValidationError(`--evidence ${flags.evidence} is not an evidence bundle (no requests.json)`, 'evidence', 'bundle');
    }
    const out = analysisOutDir({ evidence: evidenceDir, out: flags.out });
    const outDir = out.dir;
    if (out.warning) {
      this.warnings.push(out.warning);
      this.log(chalk.yellow(`  ! ${out.warning}`));
    }

    this.log(chalk.blue(`\nAnalyzing ${dir}${evidenceDir ? `, joined to ${evidenceDir}` : ''}\n`));
    const outcome = await analyzeProject({ dir, srcDir: flags.src, outDir, evidenceDir, runTests: flags['run-tests'] });
    const { graph, tests, history, join } = outcome;

    const assignment: Record<string, number> = { screen: 0, shared: 0, shell: 0, unreached: 0 };
    for (const f of graph.files) assignment[f.assignment.category] += 1;
    const endpoints = new Set(graph.files.filter((f) => f.apiClient).flatMap((f) => f.endpoints.map((e) => `${e.method} ${e.url}`)));
    const storeReads = graph.files.reduce((n, f) => n + f.storeReads.length, 0);

    if (assignment.unreached > 0) {
      this.warnings.push(`${assignment.unreached} source file(s) are reached from no entry or route — dead code, or an entry the analysis missed`);
    }
    if (!tests.run.ran && flags['run-tests']) this.warnings.push(`tests not run: ${tests.run.reason}`);
    if (join && join.summary.unexplained > 0) {
      this.warnings.push(`${join.summary.unexplained} observed endpoint(s) have no call site in source`);
    }

    this.log(
      chalk.green(
        `  ✓ ${graph.files.length} files — ${assignment.screen} screen, ${assignment.shared} shared, ${assignment.shell} shell, ` +
          `${assignment.unreached} unreached; ${graph.routes.length} routes, ${endpoints.size} endpoints, ${storeReads} store reads`
      )
    );
    this.log(
      `  tests: ${tests.files.length} files` +
        (tests.run.ran ? ` — ${tests.run.passed} passed, ${tests.run.failed} failed, ${tests.run.skipped} skipped` : ` (not run: ${tests.run.reason})`)
    );
    if (join) {
      this.log(
        `  join: ${join.summary.explained}/${join.summary.observedEndpoints} observed endpoints explained by source; ` +
          `${join.summary.sourceOnly} in source but never observed; ${join.summary.filesSeenAtRuntime} files seen at runtime`
      );
    }
    this.log(`  out   ${outDir}\n`);

    return {
      dir,
      outDir,
      sourceFiles: graph.files.length,
      assignment,
      routes: graph.routes.length,
      endpoints: endpoints.size,
      storeReads,
      tests: { files: tests.files.length, ...tests.run },
      history: { coChangePairs: history.coChange.length, ownedFiles: Object.keys(history.owners).length, unavailable: history.unavailable },
      join: join ? join.summary : null,
      files: outcome.files,
    };
  }
}
