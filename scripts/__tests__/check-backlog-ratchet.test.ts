/**
 * The backlog ratchet gate (ADR-000 §3).
 *
 * Pure halves only: parsing a backlog file, and the three things a baseline can
 * be — a list, a file that does not exist yet at that revision, and a revision
 * nobody can read. The git read is the wrapper's one impure step.
 *
 * Refs #252 · ADR-000
 */
import { parseBacklogIds, ratchetResult } from '../check-backlog-ratchet';

const backlog = (ids: number[]): string =>
  JSON.stringify({
    '//': 'a comment key, as the real file carries',
    adrs: ids.map((adr) => ({ adr, title: `ADR ${adr}` })),
  });

describe('parseBacklogIds', () => {
  it('reads the ids and ignores the comment keys', () => {
    expect(parseBacklogIds(backlog([2, 3, 84]))).toEqual([2, 3, 84]);
  });

  it('reads an empty list as an empty list', () => {
    expect(parseBacklogIds(backlog([]))).toEqual([]);
  });

  it('throws on unparseable content rather than reporting zero entries', () => {
    // Silently reading a corrupt file as "no ids" would make the gate pass while
    // checking nothing — every id would look removed, never added.
    expect(() => parseBacklogIds('{ not json')).toThrow();
  });
});

describe('ratchetResult', () => {
  it('passes when the list shrank', () => {
    expect(ratchetResult(backlog([2]), { kind: 'text', text: backlog([2, 3]) })).toEqual({
      ok: true,
      added: [],
    });
  });

  it('fails and names the ids when the list grew', () => {
    expect(ratchetResult(backlog([2, 3, 84]), { kind: 'text', text: backlog([2, 3]) })).toEqual({
      ok: false,
      added: [84],
    });
  });

  it('passes on the change that introduces the backlog', () => {
    // The baseline revision exists and simply has no such file — the snapshot is
    // being taken. Every later change is measured against it.
    expect(ratchetResult(backlog([2, 3]), { kind: 'absent' })).toEqual({ ok: true, added: [] });
  });

  it('fails when the baseline revision cannot be read at all', () => {
    // The failure mode that would have made this gate decoration: no comparison,
    // silent pass. A shallow clone has to break the build, not pass it.
    expect(ratchetResult(backlog([2]), { kind: 'unavailable' })).toEqual({ ok: false });
  });
});
