import { randomUUID } from 'crypto';
import { Hook } from '@oclif/core';
import { ValidationError, exitCodeFor, formatError } from '@seans-mfe/contracts';

/**
 * oclif command_not_found hook.
 * Under --json: emits a `CommandResult` error envelope (ADR-018) and exits with
 * the code that envelope declares. Otherwise: falls through to oclif's default
 * "command not found" display.
 *
 * This used to inline a pre-contract `{ success, error: { suggestions } }`
 * shape and exit a hardcoded 2 (#331) — so the response an agent is most
 * likely to hit while discovering the CLI was the one it could not parse
 * with the same code path as every other.
 */
const hook: Hook<'command_not_found'> = async function (opts) {
  const isJson = process.argv.includes('--json');
  if (!isJson) return; // oclif renders its default error and suggestion text

  const correlationId = process.env.SEANS_MFE_CORRELATION_ID ?? randomUUID();
  const envelope = formatError(
    new ValidationError(`command ${opts.id} not found`, 'command', 'known-command'),
    correlationId,
  );
  if (envelope.error) {
    envelope.error.details = {
      command: opts.id,
      suggestions: nearestCommands(opts.id, opts.config?.commandIDs ?? []),
    };
  }

  process.stdout.write(JSON.stringify(envelope) + '\n');
  // Same exit-code contract as BaseCommand.run() (ADR-018): the code is the
  // one the envelope declares, not a literal.
  // eslint-disable-next-line no-process-exit
  process.exit(exitCodeFor(envelope.error?.type ?? 'unknown'));
};

/**
 * Up to three known command ids closest to what was typed, nearest first.
 * A candidate further away than a third of the typed id's length is noise,
 * not a suggestion.
 */
export function nearestCommands(typed: string, known: readonly string[]): string[] {
  const limit = Math.max(2, Math.floor(typed.length / 3));
  return known
    .map((id) => ({ id, distance: editDistance(typed, id) }))
    .filter((c) => c.distance <= limit)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((c) => c.id);
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

export default hook;
