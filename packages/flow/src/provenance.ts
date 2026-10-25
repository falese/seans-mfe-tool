/**
 * What an output was built from (ADR-119 §2, as amended).
 *
 * A step writes, beside its output, the content digest of each input it read:
 * `<output>.from.json`, with paths relative to the output so a moved or cloned
 * directory still resolves. Freshness is then a comparison of contents, which a
 * `git checkout` — rewriting every file's modification time — cannot fake.
 * This is the same idea as the approval hash (ADR-116 §5): the artifact says
 * what it is true of. Nothing outside the artifacts records progress.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface Provenance {
  /** Input path, relative to the output's directory → `sha256:<hex>`. */
  inputs: Record<string, string>;
}

export const provenanceOf = (output: string): string => `${output}.from.json`;

/** `sha256:<hex>` of a file's content, or null when it does not exist. */
export function digestFile(file: string): string | null {
  try {
    return `sha256:${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
  } catch {
    return null;
  }
}

/** Record what `output` was built from. Inputs that do not exist are left out. */
export async function writeProvenance(output: string, inputs: string[]): Promise<void> {
  const record: Provenance = { inputs: {} };
  for (const input of inputs) {
    const digest = digestFile(input);
    if (digest) record.inputs[path.relative(path.dirname(output), input).split(path.sep).join('/')] = digest;
  }
  await fs.promises.writeFile(provenanceOf(output), `${JSON.stringify(record, null, 2)}\n`);
}
