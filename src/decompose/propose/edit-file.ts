/**
 * Apply named edits to a decomposition.yaml on disk and re-derive its fleet
 * (ADR-110 §4) — the core of `decompose:edit`.
 *
 * A dry run applies and validates the same way and writes nothing: it is how
 * the agent's edits are checked before anyone sees them (ADR-117 §4).
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { deriveFleet, type DerivedFleet } from './derive';
import { applyEdits } from './edit';
import { dumpYaml, readDecomposition, readSpecs, writeFleet } from './io';
import type { Decomposition, EditOp } from './model';

export interface EditedProposal {
  edited: Decomposition;
  validation: DerivedFleet['validation'];
  valid: boolean;
  /** What was written; empty on a dry run. */
  files: string[];
}

export async function editProposalFile(file: string, ops: EditOp[], opts: { dryRun: boolean }): Promise<EditedProposal> {
  const edited = applyEdits(await readDecomposition(file), ops);
  // The proposal's specs (ADR-112) follow the edit: each BFF is re-cut to what its domain now calls.
  const fleet = deriveFleet(edited, await readSpecs(path.dirname(file)));
  const valid = Object.values(fleet.validation.manifests).every((e) => e.length === 0) && fleet.validation.composition.length === 0;
  if (opts.dryRun) return { edited, validation: fleet.validation, valid, files: [] };

  await fs.writeFile(file, `# Edited with decompose:edit; re-derive with decompose:propose --from, or edit again.\n${dumpYaml(edited)}`);
  const files = [file, ...(await writeFleet(path.dirname(file), fleet))];
  return { edited, validation: fleet.validation, valid, files: files.sort() };
}
