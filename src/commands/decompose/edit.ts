/**
 * decompose:edit — apply named edits to a decomposition.yaml and re-derive the
 * fleet (ADR-110 §4, #416).
 *
 * Renames, merges and moves are applied as operations, so every reference to
 * what changed — routes, repeated placements, couplings, tests, coverage —
 * moves with it, and the derived manifests and composition stay consistent.
 * Flag edits apply in a fixed order: domain renames, merges, splits, file
 * moves, capability renames, slot renames. `--ops` takes any named edit as
 * JSON — comments, suggestions, accepting or rejecting one, approval — and is
 * how the workspace changes the document (ADR-116 §3); those apply after the
 * flags, in the order given.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { deriveFleet } from '../../decompose/propose/derive';
import { applyEdits, approvalStatus, parseEditFlags, parseEditOps } from '../../decompose/propose/edit';
import { dumpYaml, readDecomposition, readSpecs, writeFleet } from '../../decompose/propose/io';
import type { DecomposeEditResult } from '../../oclif/results';

export default class DecomposeEdit extends BaseCommand<DecomposeEditResult> {
  static description =
    'Apply named edits to a decomposition.yaml — rename, merge or split domains, move a file, rename a capability ' +
    'or slot, comment, suggest, approve — keeping every reference consistent, then re-derive and validate the fleet ' +
    '(ADR-110, ADR-116).';

  static args = {
    proposal: Args.string({ description: 'The decomposition.yaml to edit', required: true }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml --rename-domain shell=console --move src/utils/constants.ts=console',
    '$ seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml --merge docking,cargo=harbor',
    '$ seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml --split cargo=hazmat:src/pages/cargo/HazardSummary.tsx',
    `$ seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml --ops '[{"kind":"approve","by":"sean","at":"2026-10-25T12:00:00Z"}]'`,
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    'rename-domain': Flags.string({ description: 'from=to', multiple: true }),
    merge: Flags.string({ description: 'a,b[,…]=into — merge domains into one', multiple: true }),
    split: Flags.string({ description: 'domain=into:file[,file…] — split files out of a domain into a new one', multiple: true }),
    move: Flags.string({ description: 'file=domain — move a file (and any capability it holds); domain may be "shared"', multiple: true }),
    'rename-capability': Flags.string({ description: 'from=to', multiple: true }),
    'rename-slot': Flags.string({ description: 'from=to', multiple: true }),
    ops: Flags.string({
      description: 'Named edits as a JSON list (or @file): any edit kind, including comment, suggest, accept-suggestion, reject-suggestion and approve',
    }),
  };

  protected async runCommand(): Promise<DecomposeEditResult> {
    const { args, flags } = await this.parse(DecomposeEdit);
    const file = path.resolve(args.proposal);
    const ops = parseEditFlags({
      'rename-domain': flags['rename-domain'],
      merge: flags.merge,
      split: flags.split,
      move: flags.move,
      'rename-capability': flags['rename-capability'],
      'rename-slot': flags['rename-slot'],
    });
    if (flags.ops) {
      const json = flags.ops.startsWith('@') ? await fs.readFile(path.resolve(flags.ops.slice(1)), 'utf8') : flags.ops;
      ops.push(...parseEditOps(json));
    }
    if (ops.length === 0) throw new ValidationError('no edits given — see --help for the edit flags', 'edits', 'non-empty');

    const edited = applyEdits(await readDecomposition(file), ops);
    await fs.writeFile(file, `# Edited with decompose:edit; re-derive with decompose:propose --from, or edit again.\n${dumpYaml(edited)}`);
    // The proposal's specs (ADR-112) follow the edit: each BFF is re-cut to what its domain now calls.
    const fleet = deriveFleet(edited, await readSpecs(path.dirname(file)));
    const files = [file, ...(await writeFleet(path.dirname(file), fleet))];
    const valid = Object.values(fleet.validation.manifests).every((e) => e.length === 0) && fleet.validation.composition.length === 0;

    for (const op of ops) {
      const args = Object.entries(op)
        .filter(([k]) => k !== 'kind')
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : typeof v === 'object' ? JSON.stringify(v) : v}`);
      this.log(`  ${chalk.cyan(op.kind)} ${args.join(' ')}`);
    }
    this.log(`  domains: ${edited.domains.map((d) => d.id).join(', ')}`);
    const approval = approvalStatus(edited);
    if (approval !== 'none') this.log(`  approval: ${approval === 'current' ? chalk.green('current') : chalk.yellow('stale — the proposal changed after it was approved')}`);
    this.log(valid ? chalk.green('  ✓ every manifest and the composition validate\n') : chalk.red('  ✗ validation failed — see validation in --json\n'));
    if (!valid) this.warnings.push('derived manifests or composition do not validate after the edits');

    return {
      proposal: file,
      edits: ops.map((op) =>
        Object.fromEntries(Object.entries(op).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : typeof v === 'object' ? JSON.stringify(v) : String(v)]))
      ),
      domains: edited.domains.map((d) => d.id),
      approval,
      suggestions: (edited.suggestions ?? []).length,
      validation: fleet.validation,
      valid,
      files: files.sort(),
    };
  }
}
