/**
 * Test triage for a decomposition (#415, PDR-011): each of the monolith's
 * tests is kept (moves with its component), rewritten (replaced by a
 * behavioral test), or discarded, with the reasons.
 *
 * The rules are the usual test smells, applied to the facts the inventory
 * recorded (`source/tests.ts`) — no test is read twice:
 *
 * - discard: the suite never runs it (config-excluded), or every test in it is skipped;
 * - rewrite: some tests skipped; snapshot-only; mocks a module or the HTTP
 *   client (real data shapes are never exercised); structural selectors; fixed
 *   sleeps; failing;
 * - keep: none of the above.
 */

import type { TestInventory } from '../source/tests';
import type { Decomposition } from '@seans-mfe/decompose';

export function triageTests(inventory: TestInventory, domainOf: (file: string) => string | null): Decomposition['tests'] {
  return inventory.files
    .filter((f) => f.kind !== 'support')
    .map((f) => {
      const discard: string[] = [];
      const rewrite: string[] = [];
      if (f.excluded) discard.push("excluded from the project's test run");
      if (f.tests > 0 && f.skipped >= f.tests) discard.push('every test is skipped');
      else if (f.skipped > 0) rewrite.push(`${f.skipped} of ${f.tests} tests skipped`);
      if (f.snapshots > 0 && f.snapshots >= f.tests) rewrite.push('snapshot-only: pins markup, not behavior');
      if (f.mocks.length > 0) rewrite.push(`mocks ${f.mocks.join(', ')}: real data shapes are never exercised`);
      if (f.structuralSelectors > 0) rewrite.push(`${f.structuralSelectors} structural selector(s): breaks when markup moves`);
      if (f.fixedWaits > 0) rewrite.push(`${f.fixedWaits} fixed sleep(s): timing-dependent`);
      const failed = (f.results ?? []).filter((r) => r.status === 'failed').length;
      if (failed > 0) rewrite.push(`${failed} failing`);

      const domains = [...new Set(f.touches.map(domainOf).filter((d): d is string => !!d))];
      const verdict = discard.length > 0 ? 'discard' : rewrite.length > 0 ? 'rewrite' : 'keep';
      return {
        file: f.file,
        domain: domains.length === 1 ? domains[0] : null,
        verdict,
        reasons: discard.length > 0 ? discard : rewrite.length > 0 ? rewrite : ['behavioral, and runs'],
      };
    });
}
