/**
 * decompose:port — port every domain into its MFE and compose the proposal
 * directly (ADR-126, PDR-013).
 *
 * Copies each domain's source closure into its MFE's developer-owned
 * `src/monolith/`, renders each capability inside the monolith's own
 * providers, turns the shell's route blocks into declared slots, writes the
 * shell's route table, and compiles the proposal's composition. What is left —
 * shared state each MFE now loads in full, couplings across domains — it
 * reports; decompose:verify measures it.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { writeProvenance } from '@seans-mfe/flow';
import { BaseCommand } from '../../oclif/BaseCommand';
import { portFleet } from '../../decompose/port/port';
import type { DecomposePortResult } from '../../oclif/results';

export default class DecomposePort extends BaseCommand<DecomposePortResult> {
  static description =
    'Port every domain of an approved, scaffolded proposal into its MFE and compose the proposal directly: copies each ' +
    'domain\'s source, wraps it in the monolith\'s providers, turns the shell\'s route blocks into slots (ADR-126).';

  static args = {
    proposal: Args.string({ description: 'The proposal directory (holding the approved decomposition.yaml)', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:port ./evidence/proposal',
    '$ seans-mfe-tool decompose:port ./evidence/proposal --fleet ./fleet --app-dir ./my-monolith',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    fleet: Flags.string({ description: 'The scaffolded fleet (default: what decompose:scaffold recorded)' }),
    'app-dir': Flags.string({ description: 'The monolith\'s source (default: what decompose:analyze recorded)' }),
    force: Flags.boolean({ char: 'f', description: 'Replace feature files and copies a developer has changed', default: false }),
  };

  protected async runCommand(): Promise<DecomposePortResult> {
    const { args, flags } = await this.parse(DecomposePort);
    const proposalDir = path.resolve(args.proposal);
    const result = await portFleet({ proposalDir, fleetDir: flags.fleet, appDir: flags['app-dir'], force: flags.force });
    // Which approved proposal the fleet was ported from, by content (ADR-119).
    const marker = path.join(proposalDir, 'port.json');
    await fs.writeJson(marker, { fleetDir: result.fleetDir, mfes: result.mfes.map((m) => m.name) }, { spaces: 2 });
    await writeProvenance(marker, [path.join(proposalDir, 'decomposition.yaml')]);
    this.warnings.push(...result.warnings);

    this.log(chalk.green(`\n  ✓ ${result.mfes.length} MFEs ported into ${result.fleetDir}`));
    for (const m of result.mfes) {
      this.log(`    ${m.name}  ${m.files.length} files · ${m.capabilities.join(', ') || '—'}${m.kept.length ? chalk.yellow(` · kept ${m.kept.join(', ')}`) : ''}`);
    }
    if (result.slots.length > 0) this.log(`  slots             ${result.slots.join(', ')}`);
    if (result.duplicated.length > 0) this.log(`  in several MFEs   ${result.duplicated.map((d) => d.file).join(', ')}`);
    this.log(`  composition       ${result.controlPlane} (the proposal, placed directly)`);
    this.log(chalk.gray('\n  next: build the fleet and run decompose:verify against the shell; differences are the port work left\n'));
    return result;
  }
}
