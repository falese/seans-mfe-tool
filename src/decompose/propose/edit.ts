/**
 * Named edits to a decomposition (ADR-110 §4, #416).
 *
 * Judgment — renames, merges, moving a file — is applied to `decomposition.yaml`
 * as named operations rather than free-form text edits, so every reference to
 * what changed moves with it (routes, repeated placements, couplings, tests,
 * coverage) and the re-derived fleet stays consistent. The operations are the
 * same kinds `diffProposals` lists, so an agent's edits read back the way they
 * were made.
 */

import { ValidationError } from '@seans-mfe/contracts';
import type { Decomposition, Domain } from './model';

export type EditOp =
  | { kind: 'rename-domain'; from: string; to: string }
  | { kind: 'merge-domains'; domains: string[]; into: string }
  | { kind: 'move-file'; file: string; to: string }
  | { kind: 'rename-capability'; from: string; to: string }
  | { kind: 'rename-slot'; from: string; to: string };

const DOMAIN_ID = /^[a-z][a-z0-9-]*$/;
const fail = (message: string): never => {
  throw new ValidationError(message, 'edit', 'applicable');
};

function remapDomains(doc: Decomposition, map: (id: string) => string): void {
  for (const r of doc.routes) for (const p of r.place) p.domain = map(p.domain);
  for (const p of doc.repeated) p.domain = map(p.domain);
  for (const c of doc.couplings) {
    c.domain = map(c.domain);
    c.owner = map(c.owner);
  }
  // A coupling inside one domain is not a coupling.
  doc.couplings = doc.couplings.filter((c) => c.domain !== c.owner);
  for (const s of doc.slots) s.provider = map(s.provider);
  for (const t of doc.tests) if (t.domain) t.domain = map(t.domain);
  for (const u of doc.uncovered) u.domain = map(u.domain);
  for (const s of doc.shared) s.usedBy = [...new Set(s.usedBy.map(map))].sort();
}

function domainOrFail(doc: Decomposition, id: string): Domain {
  return doc.domains.find((d) => d.id === id) ?? fail(`no domain "${id}" in the proposal`);
}

function applyOne(doc: Decomposition, op: EditOp): void {
  switch (op.kind) {
    case 'rename-domain': {
      const d = domainOrFail(doc, op.from);
      if (!DOMAIN_ID.test(op.to)) fail(`"${op.to}" is not a domain id (lower-case kebab-case)`);
      if (doc.domains.some((x) => x.id === op.to)) fail(`domain "${op.to}" already exists — merge instead`);
      d.id = op.to;
      d.mfe = `${doc.app.name}-${op.to}`;
      remapDomains(doc, (id) => (id === op.from ? op.to : id));
      return;
    }
    case 'merge-domains': {
      if (op.domains.length < 2) fail('merge needs at least two domains');
      const merged = op.domains.map((id) => domainOrFail(doc, id));
      if (!DOMAIN_ID.test(op.into)) fail(`"${op.into}" is not a domain id (lower-case kebab-case)`);
      if (doc.domains.some((x) => x.id === op.into && !op.domains.includes(x.id))) fail(`domain "${op.into}" already exists`);
      const into: Domain = {
        id: op.into,
        mfe: `${doc.app.name}-${op.into}`,
        shell: merged.some((d) => d.shell),
        files: [...new Set(merged.flatMap((d) => d.files))].sort(),
        capabilities: merged.flatMap((d) => d.capabilities),
        backends: [...new Set(merged.flatMap((d) => d.backends))].sort(),
        endpoints: [...new Set(merged.flatMap((d) => d.endpoints))].sort(),
        // Evidence scores describe a boundary the clustering drew; this one was drawn by hand.
        evidence: { route: null, data: null, imports: null, runtime: null, cochange: null, ownership: null },
        reasons: [`merged from ${op.domains.join(', ')} by edit`, ...merged.flatMap((d) => d.reasons)],
      };
      const at = doc.domains.indexOf(merged[0]);
      doc.domains = doc.domains.filter((d) => !merged.includes(d));
      doc.domains.splice(Math.min(at, doc.domains.length), 0, into);
      remapDomains(doc, (id) => (op.domains.includes(id) ? op.into : id));
      return;
    }
    case 'move-file': {
      const from = doc.domains.find((d) => d.files.includes(op.file));
      const fromShared = doc.shared.find((s) => s.file === op.file);
      const fromUnassigned = doc.unassigned.includes(op.file);
      if (!from && !fromShared && !fromUnassigned) fail(`${op.file} is not in the proposal`);
      if (op.to === 'shared') {
        if (from?.capabilities.some((c) => c.file === op.file)) fail(`${op.file} holds a capability; move it to a domain, not to shared`);
        if (from) from.files = from.files.filter((f) => f !== op.file);
        doc.unassigned = doc.unassigned.filter((f) => f !== op.file);
        if (!fromShared) doc.shared.push({ file: op.file, usedBy: from ? [from.id] : [], suggestion: 'split by domain' });
        return;
      }
      const to = domainOrFail(doc, op.to);
      if (from === to) return;
      if (from) from.files = from.files.filter((f) => f !== op.file);
      doc.shared = doc.shared.filter((s) => s.file !== op.file);
      doc.unassigned = doc.unassigned.filter((f) => f !== op.file);
      to.files = [...to.files, op.file].sort();
      if (from) {
        // A capability moves with its file, and its placements follow.
        const moving = from.capabilities.filter((c) => c.file === op.file);
        from.capabilities = from.capabilities.filter((c) => c.file !== op.file);
        to.capabilities.push(...moving);
        const names = new Set(moving.map((c) => c.name));
        for (const r of doc.routes) for (const p of r.place) if (names.has(p.capability)) p.domain = to.id;
        for (const p of doc.repeated) if (names.has(p.capability)) p.domain = to.id;
        for (const u of doc.uncovered) if (names.has(u.capability)) u.domain = to.id;
      }
      for (const c of doc.couplings) if (c.file === op.file) c.domain = to.id;
      doc.couplings = doc.couplings.filter((c) => c.domain !== c.owner);
      return;
    }
    case 'rename-capability': {
      const owner = doc.domains.find((d) => d.capabilities.some((c) => c.name === op.from)) ?? fail(`no capability "${op.from}" in the proposal`);
      if (!/^[A-Z][A-Za-z0-9]*$/.test(op.to)) fail(`"${op.to}" is not a capability name (PascalCase)`);
      if (doc.domains.some((d) => d.capabilities.some((c) => c.name === op.to))) fail(`capability "${op.to}" already exists`);
      for (const c of owner.capabilities) if (c.name === op.from) c.name = op.to;
      for (const r of doc.routes) for (const p of r.place) if (p.capability === op.from) p.capability = op.to;
      for (const p of doc.repeated) if (p.capability === op.from) p.capability = op.to;
      for (const u of doc.uncovered) if (u.capability === op.from) u.capability = op.to;
      return;
    }
    case 'rename-slot': {
      const slot = doc.slots.find((s) => s.id === op.from) ?? fail(`no slot "${op.from}" in the proposal`);
      if (doc.slots.some((s) => s.id === op.to)) fail(`slot "${op.to}" already exists`);
      slot.id = op.to;
      for (const r of doc.routes) for (const p of r.place) if (p.slot === op.from) p.slot = op.to;
      for (const p of doc.repeated) if (p.slot === op.from) p.slot = op.to;
      return;
    }
  }
}

/** Apply edits in order to a copy of `doc`. */
export function applyEdits(doc: Decomposition, ops: EditOp[]): Decomposition {
  const out = JSON.parse(JSON.stringify(doc)) as Decomposition;
  for (const op of ops) applyOne(out, op);
  return out;
}

const pair = (flag: string, value: string): [string, string] => {
  const i = value.lastIndexOf('=');
  if (i <= 0 || i === value.length - 1) fail(`--${flag} expects from=to, got "${value}"`);
  return [value.slice(0, i), value.slice(i + 1)];
};

/** Read edits from command-line flags, in a fixed order: renames, merges, moves, capability and slot renames. */
export function parseEditFlags(flags: Partial<Record<'rename-domain' | 'merge' | 'move' | 'rename-capability' | 'rename-slot', string[]>>): EditOp[] {
  const ops: EditOp[] = [];
  for (const v of flags['rename-domain'] ?? []) {
    const [from, to] = pair('rename-domain', v);
    ops.push({ kind: 'rename-domain', from, to });
  }
  for (const v of flags.merge ?? []) {
    const [list, into] = pair('merge', v);
    ops.push({ kind: 'merge-domains', domains: list.split(',').map((s) => s.trim()).filter(Boolean), into });
  }
  for (const v of flags.move ?? []) {
    const [file, to] = pair('move', v);
    ops.push({ kind: 'move-file', file, to });
  }
  for (const v of flags['rename-capability'] ?? []) {
    const [from, to] = pair('rename-capability', v);
    ops.push({ kind: 'rename-capability', from, to });
  }
  for (const v of flags['rename-slot'] ?? []) {
    const [from, to] = pair('rename-slot', v);
    ops.push({ kind: 'rename-slot', from, to });
  }
  return ops;
}
