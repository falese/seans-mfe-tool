/**
 * Where `decompose:analyze` writes (ADR-109 §3). Joined to a capture, the
 * analysis goes inside that bundle (`<bundle>/source`), so capture, analysis
 * and proposal stay one directory; without one it still runs, but nothing it
 * finds can be matched to observed traffic, and the caller is told so.
 */

import * as path from 'path';

export function analysisOutDir(flags: { evidence?: string; out?: string }): { dir: string; warning?: string } {
  if (flags.out) return { dir: path.resolve(flags.out) };
  if (flags.evidence) return { dir: path.resolve(flags.evidence, 'source') };
  return {
    dir: path.resolve('./evidence/source'),
    warning:
      'the analysis is not joined to a capture, so no observed call can be explained — pass --evidence <bundle> ' +
      '(the decompose:capture output) to write it inside that bundle',
  };
}
