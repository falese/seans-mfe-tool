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

import { createHash } from 'crypto';
import { ValidationError } from '@seans-mfe/contracts';
import { backendOf } from './backends';
import { EditOpSchema, type Decomposition, type Domain, type EditOp } from './model';

export type { EditOp } from './model';

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

/**
 * What a domain's files call, from the proposal's per-file data. A proposal
 * written before it existed keeps the domain's data as it was.
 */
function recomputeData(doc: Decomposition, d: Domain): void {
  if (!doc.fileEndpoints || d.shell) return;
  const data = doc.fileEndpoints;
  d.endpoints = [...new Set(d.files.flatMap((f) => data[f] ?? []))].sort();
  d.backends = [...new Set(d.endpoints.map((e) => backendOf(e.split(' ')[1], { gateway: doc.app.gateway !== false })))].sort();
}

/** The next free id with this prefix: c1, c2, … */
const nextId = (prefix: string, taken: Array<{ id: string }>) =>
  `${prefix}${1 + Math.max(0, ...taken.map((x) => Number(x.id.slice(prefix.length)) || 0))}`;

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
      if (from) recomputeData(doc, from);
      recomputeData(doc, to);
      return;
    }
    case 'split-domain': {
      const from = domainOrFail(doc, op.domain);
      if (!DOMAIN_ID.test(op.into)) fail(`"${op.into}" is not a domain id (lower-case kebab-case)`);
      if (doc.domains.some((x) => x.id === op.into)) fail(`domain "${op.into}" already exists`);
      for (const f of op.files) if (!from.files.includes(f)) fail(`${f} is not in ${op.domain}`);
      if (op.files.length >= from.files.length) fail(`splitting every file out would leave ${op.domain} empty — rename it instead`);
      const into: Domain = {
        id: op.into,
        mfe: `${doc.app.name}-${op.into}`,
        shell: false,
        files: [],
        capabilities: [],
        backends: [],
        endpoints: [],
        evidence: { route: null, data: null, imports: null, runtime: null, cochange: null, ownership: null },
        reasons: [`split from ${op.domain} by edit`],
      };
      doc.domains.splice(doc.domains.indexOf(from) + 1, 0, into);
      // The moved files take their capabilities, placements, couplings and data with them.
      for (const file of op.files) applyOne(doc, { kind: 'move-file', file, to: op.into });
      return;
    }
    case 'comment': {
      if (op.about !== undefined) domainOrFail(doc, op.about);
      const comments = doc.comments ?? [];
      comments.push({ id: nextId('c', comments), by: op.by, at: op.at, text: op.text, ...(op.about !== undefined ? { about: op.about } : {}) });
      doc.comments = comments;
      return;
    }
    case 'suggest': {
      // The schema admits only suggestable edits; this guards callers that skip it.
      if (['suggest', 'approve', 'accept-suggestion', 'reject-suggestion'].includes((op.edit as { kind: string }).kind)) {
        fail(`a ${(op.edit as { kind: string }).kind} cannot be suggested — only edits to the proposal can`);
      }
      const suggestions = doc.suggestions ?? [];
      suggestions.push({
        id: nextId('s', suggestions),
        by: op.by,
        at: op.at,
        explanation: op.explanation,
        ...(op.request !== undefined ? { request: op.request } : {}),
        edit: op.edit,
      });
      doc.suggestions = suggestions;
      return;
    }
    case 'accept-suggestion':
    case 'reject-suggestion': {
      const s = (doc.suggestions ?? []).find((x) => x.id === op.id) ?? fail(`no suggestion "${op.id}" in the proposal`);
      if (op.kind === 'accept-suggestion') applyOne(doc, s.edit);
      doc.suggestions = (doc.suggestions ?? []).filter((x) => x !== s);
      return;
    }
    case 'approve': {
      doc.approval = { by: op.by, at: op.at, hash: approvalHash(doc) };
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

/** Keys in a stable order, so the hash does not depend on how the YAML was written. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])])
    );
  }
  return value;
}

/**
 * A hash of what the proposal decides — everything but the conversation about
 * it (comments, pending suggestions) and the approval itself (ADR-116 §5).
 */
export function approvalHash(doc: Decomposition): string {
  const { approval: _a, comments: _c, suggestions: _s, ...decision } = doc;
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(decision))).digest('hex')}`;
}

/** Whether the recorded approval still names this document. */
export function approvalStatus(doc: Decomposition): 'none' | 'current' | 'stale' {
  if (!doc.approval) return 'none';
  return doc.approval.hash === approvalHash(doc) ? 'current' : 'stale';
}

/** Edits as JSON (`decompose:edit --ops`, the workspace API), checked against the schema. */
export function parseEditOps(json: string): EditOp[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail('the edits are not JSON');
  }
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((item, i) => {
    const parsed = EditOpSchema.safeParse(item);
    if (parsed.success) return parsed.data;
    const kind = (item as { kind?: unknown } | null)?.kind;
    const known = EditOpSchema.options.map((o) => o.shape.kind.value as string);
    const why = typeof kind !== 'string' || !known.includes(kind)
      ? `"${String(kind)}" is not a known edit (${known.join(', ')})`
      : parsed.error.issues.map((x) => `${x.path.join('.') || 'edit'}: ${x.message}`).join('; ');
    return fail(`edit ${i + 1}: ${why}`);
  });
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

/** Read edits from command-line flags, in a fixed order: renames, merges, splits, moves, capability and slot renames. */
export function parseEditFlags(
  flags: Partial<Record<'rename-domain' | 'merge' | 'split' | 'move' | 'rename-capability' | 'rename-slot', string[]>>
): EditOp[] {
  const ops: EditOp[] = [];
  for (const v of flags['rename-domain'] ?? []) {
    const [from, to] = pair('rename-domain', v);
    ops.push({ kind: 'rename-domain', from, to });
  }
  for (const v of flags.merge ?? []) {
    const [list, into] = pair('merge', v);
    ops.push({ kind: 'merge-domains', domains: list.split(',').map((s) => s.trim()).filter(Boolean), into });
  }
  for (const v of flags.split ?? []) {
    const m = /^([^=]+)=([^:]+):(.+)$/.exec(v) ?? fail(`--split expects domain=into:file[,file…], got "${v}"`);
    ops.push({ kind: 'split-domain', domain: m[1], into: m[2], files: m[3].split(',').map((s) => s.trim()).filter(Boolean) });
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
