/**
 * ADR-000 §3 says the conformance backlog "fails on any addition" and "may only
 * shrink". The rule as shipped only reported *stale* entries — an id that had
 * since gained a gate — so appending an id silenced `enforced-claims-a-gate`
 * with nothing to notice. The claim named no checker, which is the one thing
 * ADR-000 forbids.
 *
 * Refs #252 · ADR-000
 */
import { backlogAdditions } from '../adr-validation';

describe('backlogAdditions', () => {
  it('reports an id that is not in the baseline', () => {
    expect(backlogAdditions([2, 3, 84], [2, 3])).toEqual([84]);
  });

  it('is silent when the list shrank, which is the sanctioned direction', () => {
    expect(backlogAdditions([2], [2, 3, 4])).toEqual([]);
  });

  it('is silent when the list is unchanged', () => {
    expect(backlogAdditions([2, 3], [3, 2])).toEqual([]);
  });

  it('reports additions in ascending order, however the file ordered them', () => {
    expect(backlogAdditions([84, 2, 12], [2])).toEqual([12, 84]);
  });

  it('treats an empty baseline as forbidding every entry', () => {
    // A baseline that could not be read must not be mistaken for consent: the
    // caller decides whether an unreadable baseline is an error, and if it hands
    // over an empty one the answer here is "all of these are additions".
    expect(backlogAdditions([2, 3], [])).toEqual([2, 3]);
  });
});
