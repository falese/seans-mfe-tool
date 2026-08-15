#!/usr/bin/env ts-node
/**
 * ADR library drift gate (ADR-075).
 *
 * CI wiring for `adr:validate`. The rules live in `@falese/smt-dsl`
 * (`validateAdrLibrary`, unit-tested) and the IO in the command core
 * (`adrValidateCommand`); this is the wrapper that runs it over the repo and
 * sets an exit code — the same shape as `scripts/check-mfe-consistency.ts`,
 * which calls the `mfe:validate` core rather than duplicating it.
 *
 * Usage:
 *   npm run check:adr                    # gate the library
 *   npm run check:adr -- --include-examples
 *
 * Refs ADR-075.
 */

import { adrValidateCommand } from '../src/commands/adr/validate';

async function main(): Promise<void> {
  const includeExamples = process.argv.includes('--include-examples');

  try {
    await adrValidateCommand({ includeExamples });
  } catch {
    // adrValidateCommand already printed the per-rule detail.
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
