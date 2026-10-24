/**
 * `decompose:score` — a proposal against an answer key (#415).
 *
 * Names are the agent's to choose (`shell` or `console`, `aside` or `status`),
 * so nothing here compares names. Proposed domains are matched to answer
 * domains by the files they share, and proposed slots to answer slots by the
 * placements they share; everything is scored through those matchings.
 *
 * `diffProposals` turns the agent's edits to the deterministic draft into a
 * list — the record of judgment that a fine-tuning corpus wants (PDR-009).
 */

import type { Decomposition } from './model';

export interface AnswerKey {
  domains: Array<{ id: string; capabilities: string[]; backends: string[] }>;
  backends: Record<string, { proxy: string }>;
  /** file → domain id, or `shared`. */
  files: Record<string, string>;
  /**
   * Path → slot → capability (null for an empty slot). Keys that are not paths
   * (`berth-strip`) are repeated placements: `{ capability, into }`.
   */
  routes: Record<string, Record<string, string | null>>;
  tests: Array<{ file: string; verdict: string }>;
  untested_behaviors: string[];
}

export interface Score {
  /** Proposal domain → matched answer domain, or null. */
  domainMap: Record<string, string | null>;
  assignment: { correct: number; total: number; precision: number; recall: number; f1: number; misplaced: Array<{ file: string; proposed: string; expected: string }> };
  backends: { perDomain: Record<string, number>; mean: number };
  slots: { slotMap: Record<string, string>; matched: number; total: number; score: number };
  tests: { agree: number; total: number; score: number; disagreements: Array<{ file: string; proposed: string; expected: string }> };
  gaps: { detected: string[]; missed: string[]; unmatchable: string[]; recall: number };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** One-to-one greedy matching on a weight table: heaviest pairs first, ties by name. */
function match(weights: Map<string, Map<string, number>>, prefer?: (a: string, b: string) => boolean): Map<string, string> {
  const pairs: Array<[string, string, number]> = [];
  for (const [a, row] of weights) for (const [b, w] of row) if (w > 0) pairs.push([a, b, w]);
  pairs.sort(
    (x, y) =>
      y[2] - x[2] ||
      Number(prefer?.(y[0], y[1]) ?? false) - Number(prefer?.(x[0], x[1]) ?? false) ||
      x[0].localeCompare(y[0]) ||
      x[1].localeCompare(y[1])
  );
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const [a, b] of pairs) {
    if (out.has(a) || used.has(b)) continue;
    out.set(a, b);
    used.add(b);
  }
  return out;
}

function bump(m: Map<string, Map<string, number>>, a: string, b: string): void {
  const row = m.get(a) ?? m.set(a, new Map()).get(a) as Map<string, number>;
  row.set(b, (row.get(b) ?? 0) + 1);
}

export function scoreProposal(doc: Decomposition, key: AnswerKey): Score {
  // ---- domains, matched by shared files --------------------------------------------
  const overlap = new Map<string, Map<string, number>>();
  for (const d of doc.domains) {
    overlap.set(d.id, new Map());
    for (const f of d.files) {
      const expected = key.files[f];
      if (expected && expected !== 'shared') bump(overlap, d.id, expected);
    }
  }
  // Ties go to the identical name: a tie-break only, never a score.
  const matched = match(overlap, (a, b) => a === b);
  const domainMap = Object.fromEntries(doc.domains.map((d) => [d.id, matched.get(d.id) ?? null]));

  // ---- assignment ---------------------------------------------------------------------
  const proposed = new Map<string, string>();
  for (const d of doc.domains) for (const f of d.files) proposed.set(f, d.id);
  for (const s of doc.shared) proposed.set(s.file, 'shared');
  const misplaced: Score['assignment']['misplaced'] = [];
  let correct = 0;
  let labeled = 0;
  for (const [file, expected] of Object.entries(key.files)) {
    const p = proposed.get(file);
    if (p !== undefined) labeled += 1;
    const asAnswer = p === 'shared' ? 'shared' : p ? domainMap[p] : null;
    if (asAnswer === expected) correct += 1;
    else misplaced.push({ file, proposed: p ?? '(none)', expected });
  }
  const total = Object.keys(key.files).length;
  const precision = labeled === 0 ? 0 : correct / labeled;
  const recall = total === 0 ? 0 : correct / total;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  // ---- backends -------------------------------------------------------------------------
  const backendName = (id: string) =>
    Object.entries(key.backends).find(([, b]) => b.proxy.replace(/\/+$/, '').split('/').pop() === id)?.[0] ?? id;
  const perDomain: Record<string, number> = {};
  for (const answer of key.domains) {
    const mine = doc.domains.find((d) => domainMap[d.id] === answer.id);
    if (!mine) {
      perDomain[answer.id] = 0;
      continue;
    }
    const a = new Set(answer.backends);
    const b = new Set(mine.backends.map(backendName));
    const union = new Set([...a, ...b]);
    perDomain[answer.id] = union.size === 0 ? 1 : r3([...a].filter((x) => b.has(x)).length / union.size);
  }
  const values = Object.values(perDomain);

  // ---- slots, matched by the placements they share ------------------------------------------
  const capabilityDomain = new Map(key.domains.flatMap((d) => d.capabilities.map((c) => [c, d.id] as [string, string])));
  type Placed = { at: string; slot: string; domain: string };
  const expected: Placed[] = [];
  for (const [at, entry] of Object.entries(key.routes)) {
    if (at.startsWith('/')) {
      for (const [slot, capability] of Object.entries(entry)) {
        if (slot === 'stateKey' || !capability) continue;
        const d = capabilityDomain.get(capability);
        if (d) expected.push({ at, slot, domain: d });
      }
    } else if (entry.capability && entry.into) {
      const d = capabilityDomain.get(entry.capability);
      if (d) expected.push({ at: '(repeated)', slot: entry.into.split('/').pop() as string, domain: d });
    }
  }
  const proposedPlaced: Placed[] = [
    ...doc.routes.flatMap((r) => r.place.map((p) => ({ at: r.path, slot: p.slot, domain: domainMap[p.domain] ?? `?${p.domain}` }))),
    ...doc.repeated.map((p) => ({ at: '(repeated)', slot: p.slot, domain: domainMap[p.domain] ?? `?${p.domain}` })),
  ];
  const slotMap = bestSlotMap(expected, proposedPlaced);
  const countMatched = (map: Map<string, string>) =>
    expected.filter((e) => proposedPlaced.some((p) => p.at === e.at && p.domain === e.domain && map.get(p.slot) === e.slot)).length;
  const slotMatched = countMatched(slotMap);

  // ---- tests ----------------------------------------------------------------------------------
  const disagreements: Score['tests']['disagreements'] = [];
  let agree = 0;
  for (const t of key.tests) {
    const p = doc.tests.find((x) => x.file === t.file);
    if (p && p.verdict === t.verdict) agree += 1;
    else disagreements.push({ file: t.file, proposed: p?.verdict ?? '(none)', expected: t.verdict });
  }

  // ---- gaps ---------------------------------------------------------------------------------
  // An untested behavior is found when the component it names is flagged uncovered; when it
  // names only a domain, when that domain has an uncovered capability. Names are read in plain
  // words too: TrafficLog as "traffic log", life-support as "life support".
  const words = (name: string) =>
    name.replace(/\.[jt]sx?$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
  const baseName = (file: string) => (file.split('/').pop() as string).replace(/\.[jt]sx?$/, '');
  const proposedOwner = (file: string) => proposed.get(file) ?? null;
  const fromAnswer = new Map(Object.entries(domainMap).filter(([, a]) => a).map(([p, a]) => [a as string, p]));
  const components = new Map<string, { file: string | null; domain: string | null }>();
  for (const d of doc.domains) for (const c of d.capabilities) components.set(c.name, { file: c.file, domain: d.id });
  for (const d of key.domains) for (const c of d.capabilities) if (!components.has(c)) components.set(c, { file: null, domain: fromAnswer.get(d.id) ?? null });
  for (const file of Object.keys(key.files)) {
    const n = baseName(file);
    if (!components.has(n)) components.set(n, { file, domain: proposedOwner(file) });
  }
  const domainNames = new Map<string, string>();
  for (const d of doc.domains) domainNames.set(d.id, d.id);
  for (const d of key.domains) if (fromAnswer.has(d.id)) domainNames.set(d.id, fromAnswer.get(d.id) as string);
  const flaggedFiles = new Set(doc.uncovered.map((u) => u.file));
  const flaggedNames = new Set(doc.uncovered.map((u) => u.capability));
  const flaggedDomains = new Set(doc.uncovered.map((u) => u.domain));
  const mentions = (text: string, name: string) => {
    const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
    return t.includes(` ${words(name)} `) || t.includes(` ${name.toLowerCase()} `);
  };
  const detected: string[] = [];
  const missed: string[] = [];
  const unmatchable: string[] = [];
  for (const behavior of key.untested_behaviors) {
    const named = [...components].filter(([n]) => mentions(behavior, n));
    if (named.length > 0) {
      const hit = named.some(([n, c]) => flaggedNames.has(n) || (c.file !== null && flaggedFiles.has(c.file)));
      (hit ? detected : missed).push(behavior);
      continue;
    }
    const inDomains = [...domainNames].filter(([n]) => mentions(behavior, n)).map(([, d]) => d);
    if (inDomains.length === 0) unmatchable.push(behavior);
    else if (inDomains.some((d) => flaggedDomains.has(d))) detected.push(behavior);
    else missed.push(behavior);
  }

  return {
    domainMap,
    assignment: { correct, total, precision: r3(precision), recall: r3(recall), f1: r3(f1), misplaced },
    backends: { perDomain, mean: values.length === 0 ? 0 : r3(values.reduce((a, b) => a + b, 0) / values.length) },
    slots: { slotMap: Object.fromEntries(slotMap), matched: slotMatched, total: expected.length, score: expected.length === 0 ? 1 : r3(slotMatched / expected.length) },
    tests: { agree, total: key.tests.length, score: key.tests.length === 0 ? 1 : r3(agree / key.tests.length), disagreements },
    gaps: { detected, missed, unmatchable, recall: key.untested_behaviors.length === 0 ? 1 : r3(detected.length / key.untested_behaviors.length) },
  };
}

/**
 * The slot renaming that matches the most expected placements, found by trying
 * every one-to-one mapping (layouts have a handful of slots). Ties go to the
 * mapping that keeps the most names, then to the lexically first.
 */
function bestSlotMap(
  expected: Array<{ at: string; slot: string; domain: string }>,
  proposed: Array<{ at: string; slot: string; domain: string }>
): Map<string, string> {
  const from = [...new Set(proposed.map((p) => p.slot))].sort();
  const to = [...new Set(expected.map((e) => e.slot))].sort();
  const count = (map: Map<string, string>) =>
    expected.filter((e) => proposed.some((p) => p.at === e.at && p.domain === e.domain && map.get(p.slot) === e.slot)).length;
  let best = new Map<string, string>();
  let bestKey: [number, number, string] = [-1, -1, ''];
  const MAX = 8;
  if (from.length > MAX || to.length > MAX) return best;
  const search = (i: number, map: Map<string, string>, used: Set<string>): void => {
    if (i === from.length) {
      const key: [number, number, string] = [count(map), [...map].filter(([a, b]) => a === b).length, JSON.stringify([...map])];
      if (key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
        bestKey = key;
        best = new Map(map);
      }
      return;
    }
    search(i + 1, map, used); // leave this slot unmapped
    for (const t of to) {
      if (used.has(t)) continue;
      map.set(from[i], t);
      used.add(t);
      search(i + 1, map, used);
      map.delete(from[i]);
      used.delete(t);
    }
  };
  search(0, new Map(), new Set());
  return best;
}

export type Edit =
  | { kind: 'rename-domain'; from: string; to: string }
  | { kind: 'move-file'; file: string; from: string; to: string }
  | { kind: 'remove-domain'; domain: string }
  | { kind: 'add-domain'; domain: string }
  | { kind: 'rename-capability'; domain: string; from: string; to: string }
  | { kind: 'rename-slot'; from: string; to: string }
  | { kind: 'change-test-verdict'; file: string; from: string; to: string };

/** The edits that turn `base` into `edited`, domains matched by shared files. */
export function diffProposals(base: Decomposition, edited: Decomposition): Edit[] {
  const ownerIn = (doc: Decomposition) => {
    const m = new Map<string, string>();
    for (const d of doc.domains) for (const f of d.files) m.set(f, d.id);
    for (const s of doc.shared) m.set(s.file, 'shared');
    return m;
  };
  const before = ownerIn(base);
  const after = ownerIn(edited);
  const overlap = new Map<string, Map<string, number>>();
  for (const d of base.domains) {
    overlap.set(d.id, new Map());
    for (const f of d.files) {
      const to = after.get(f);
      if (to && to !== 'shared') bump(overlap, d.id, to);
    }
  }
  const map = match(overlap, (a, b) => a === b);
  const edits: Edit[] = [];
  for (const d of base.domains) {
    const to = map.get(d.id);
    if (to && to !== d.id) edits.push({ kind: 'rename-domain', from: d.id, to });
  }
  for (const file of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const from = before.get(file);
    const to = after.get(file);
    if (!from || !to) continue;
    const expectedTo = from === 'shared' ? 'shared' : (map.get(from) ?? null);
    if (expectedTo !== to) edits.push({ kind: 'move-file', file, from, to });
  }
  for (const d of base.domains) if (!map.has(d.id)) edits.push({ kind: 'remove-domain', domain: d.id });
  const targets = new Set(map.values());
  for (const d of edited.domains) if (!targets.has(d.id)) edits.push({ kind: 'add-domain', domain: d.id });
  for (const d of base.domains) {
    const e = edited.domains.find((x) => x.id === map.get(d.id));
    if (!e) continue;
    for (const c of d.capabilities) {
      const renamed = e.capabilities.find((x) => x.file === c.file && x.component === c.component);
      if (renamed && renamed.name !== c.name) edits.push({ kind: 'rename-capability', domain: e.id, from: c.name, to: renamed.name });
    }
  }
  const slotRenames = new Map<string, string>();
  for (const r of base.routes) {
    const e = edited.routes.find((x) => x.path === r.path);
    r.place.forEach((p, i) => {
      const q = e?.place[i];
      if (q && q.slot !== p.slot) slotRenames.set(p.slot, q.slot);
    });
  }
  for (const p of base.repeated) {
    const q = edited.repeated.find((x) => x.renderedBy === p.renderedBy && x.domain === (map.get(p.domain) ?? p.domain));
    if (q && q.slot !== p.slot) slotRenames.set(p.slot, q.slot);
  }
  for (const [from, to] of slotRenames) edits.push({ kind: 'rename-slot', from, to });
  for (const t of base.tests) {
    const e = edited.tests.find((x) => x.file === t.file);
    if (e && e.verdict !== t.verdict) edits.push({ kind: 'change-test-verdict', file: t.file, from: t.verdict, to: e.verdict });
  }
  return edits;
}
