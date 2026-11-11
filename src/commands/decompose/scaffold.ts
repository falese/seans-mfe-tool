/**
 * decompose:scaffold — turn an approved proposal into a fleet (#417, ADR-111).
 *
 * One generated MFE per domain (with its BFF's specs and recorded fixtures),
 * the monolith as one generated MFE (`legacy-<app>`), a generic shell, and a
 * starting composition that places the monolith everywhere, compiled to
 * rules.json. Strangling then moves one placement at a time (#419), and
 * decompose:verify checks each step (ADR-113).
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { writeProvenance } from '@seans-mfe/flow';
import { BaseCommand } from '../../oclif/BaseCommand';
import { DEFAULT_DAEMON, scaffoldFleet } from '../../decompose/scaffold/scaffold';
import type { DecomposeScaffoldResult } from '../../oclif/results';

export default class DecomposeScaffold extends BaseCommand<DecomposeScaffoldResult> {
  static description =
    'Scaffold the fleet an approved decomposition proposal describes: one generated MFE and BFF per domain, the ' +
    'monolith as a legacy-wrapper MFE, a generic shell, and a composition that starts with the monolith everywhere (ADR-111).';

  static args = {
    proposal: Args.string({ description: 'The proposal directory (holding an approved decomposition.yaml)', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:scaffold ./evidence/proposal --out ./fleet --app-dir ./my-monolith',
    '$ seans-mfe-tool decompose:scaffold ./evidence/proposal --out ./fleet --app-url http://localhost:5090/',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    out: Flags.string({ description: 'Directory to write the fleet into (default: <proposal>/../../fleet)' }),
    'app-dir': Flags.string({ description: 'The monolith\'s source directory; its public/index.html styles the shell\'s page' }),
    'app-url': Flags.string({ description: 'Where the monolith is served, for its remote entry (default: the evidence bundle\'s app)' }),
    daemon: Flags.string({ description: 'The control-plane daemon\'s graphql-ws URL the shell connects to', default: DEFAULT_DAEMON }),
    'runtime-dir': Flags.string({ description: 'A built dist/runtime to point each package.json at (the runtime is not on npm yet, ADR-064)' }),
    force: Flags.boolean({ char: 'f', description: 'Scaffold into a non-empty directory; developer-owned files are kept', default: false }),
  };

  protected async runCommand(): Promise<DecomposeScaffoldResult> {
    const { args, flags } = await this.parse(DecomposeScaffold);
    const proposalDir = path.resolve(args.proposal);
    const outDir = path.resolve(flags.out ?? path.join(proposalDir, '..', '..', 'fleet'));
    const result = await scaffoldFleet({
      proposalDir,
      outDir,
      appDir: flags['app-dir'],
      appUrl: flags['app-url'],
      daemonWsUrl: flags.daemon,
      runtimeDir: flags['runtime-dir'],
      force: flags.force,
    });
    // Which approved proposal this fleet was built from, by content (ADR-119).
    const marker = path.join(proposalDir, 'scaffold.json');
    await fs.writeJson(marker, { fleetDir: outDir, approvedHash: result.approvedHash, mfes: result.mfes.map((m) => m.name) }, { spaces: 2 });
    await writeProvenance(marker, [path.join(proposalDir, 'decomposition.yaml')]);
    this.warnings.push(...result.warnings);

    this.log(chalk.green(`\n  ✓ ${result.mfes.length} MFEs scaffolded for ${result.app} (${result.files} files) in ${outDir}`));
    for (const m of result.mfes) this.log(`    ${m.role === 'legacy' ? chalk.yellow(m.name) : m.name}  ${m.capabilities.join(', ')}`);
    this.log(`  composition       ${result.controlPlane} (the monolith, as ${result.legacy.capability}, in every state)`);
    this.log(`  strangle target   ${result.target}`);
    this.log(`  shell             ${result.shell.dir} (:${result.shell.port})`);
    this.log(chalk.gray(`\n  next: give the monolith its remote entry — ${path.join(outDir, result.legacy.mfe, 'MONOLITH-FEDERATION.md')}`));
    this.log(chalk.gray(`        then run the fleet (${path.join(outDir, 'README.md')}) and decompose:verify against the shell\n`));
    return result;
  }
}
