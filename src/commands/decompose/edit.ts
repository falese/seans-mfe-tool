/**
 * decompose:edit — apply named edits to a decomposition.yaml and re-derive the
 * fleet (ADR-110 §4, #416).
 *
 * Renames, merges and moves are applied as operations, so every reference to
 * what changed — routes, repeated placements, couplings, tests, coverage —
 * moves with it, and the derived manifests and composition stay consistent.
 * Edits apply in a fixed order: domain renames, merges, file moves, capability
 * renames, slot renames.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { deriveFleet } from '../../decompose/propose/derive';
import { applyEdits, parseEditFlags } from '../../decompose/propose/edit';
import { dumpYaml, readDecomposition, readSpecs, writeFleet } from '../../decompose/propose/io';
import type { DecomposeEditResult } from '../../oclif/results';

export default class DecomposeEdit extends BaseCommand<DecomposeEditResult> {
  static description =
    'Apply named edits to a decomposition.yaml — rename or merge domains, move a file, rename a capability or ' +
    'slot — keeping every reference consistent, then re-derive and validate the fleet (ADR-110).';

  static args = {
    proposal: Args.string({ description: 'The decomposition.yaml to edit', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml --rename-domain shell=console --move src/utils/constants.ts=console',
    '$ seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml --merge docking,cargo=harbor',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    'rename-domain': Flags.string({ description: 'from=to', multiple: true }),
    merge: Flags.string({ description: 'a,b[,…]=into — merge domains into one', multiple: true }),
    move: Flags.string({ description: 'file=domain — move a file (and any capability it holds); domain may be "shared"', multiple: true }),
    'rename-capability': Flags.string({ description: 'from=to', multiple: true }),
    'rename-slot': Flags.string({ description: 'from=to', multiple: true }),
  };

  protected async runCommand(): Promise<DecomposeEditResult> {
    const { args, flags } = await this.parse(DecomposeEdit);
    const file = path.resolve(args.proposal);
    const ops = parseEditFlags({
      'rename-domain': flags['rename-domain'],
      merge: flags.merge,
      move: flags.move,
      'rename-capability': flags['rename-capability'],
      'rename-slot': flags['rename-slot'],
    });
    if (ops.length === 0) throw new ValidationError('no edits given — see --help for the edit flags', 'edits', 'non-empty');

    const edited = applyEdits(await readDecomposition(file), ops);
    await fs.writeFile(file, `# Edited with decompose:edit; re-derive with decompose:propose --from, or edit again.\n${dumpYaml(edited)}`);
    // The proposal's specs (ADR-112) follow the edit: each BFF is re-cut to what its domain now calls.
    const fleet = deriveFleet(edited, await readSpecs(path.dirname(file)));
    const files = [file, ...(await writeFleet(path.dirname(file), fleet))];
    const valid = Object.values(fleet.validation.manifests).every((e) => e.length === 0) && fleet.validation.composition.length === 0;

    for (const op of ops) this.log(`  ${chalk.cyan(op.kind)} ${Object.entries(op).filter(([k]) => k !== 'kind').map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`).join(' ')}`);
    this.log(`  domains: ${edited.domains.map((d) => d.id).join(', ')}`);
    this.log(valid ? chalk.green('  ✓ every manifest and the composition validate\n') : chalk.red('  ✗ validation failed — see validation in --json\n'));
    if (!valid) this.warnings.push('derived manifests or composition do not validate after the edits');

    return {
      proposal: file,
      edits: ops.map((op) => Object.fromEntries(Object.entries(op).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]))),
      domains: edited.domains.map((d) => d.id),
      validation: fleet.validation,
      valid,
      files: files.sort(),
    };
  }
}
