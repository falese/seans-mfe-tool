/**
 * The decomposition playbook's mechanical rules (#420), as a Sentinel
 * `ValidatePort` over `decomposition.yaml` (ADR-089 port 1).
 *
 * Two kinds of rule, kept apart on purpose:
 *
 * - **Structural** (`validateDecomposition`): a proposal that breaks one cannot
 *   be built — a file or capability claimed by two domains, a placement naming
 *   something that does not exist, two shells. The oracle says no, and
 *   `decompose:scaffold` refuses.
 * - **Stop and ask** (`stopAndAsk`): a proposal that can be built but that an
 *   agent should not build without a person's answer — weak evidence for a
 *   boundary, one backend every domain calls, a domain that owns no data. These
 *   are the playbook's stop-and-ask conditions
 *   (`.agents/skills/decompose-monolith/SKILL.md`), and scaffold reports them.
 *
 * Pure: no file system, no browser. The derived fleet's own validation
 * (manifests and composition, ADR-110 §2) is part of the structural verdict.
 */

import type { ValidatePort, ValidationOutcome, PortValidationError } from 'sentinel';
import { DecompositionSchema, deriveFleet, type Decomposition } from '@seans-mfe/decompose';

export interface StopAndAsk {
  code: 'low-evidence' | 'backend-everywhere' | 'no-data-of-its-own';
  domain?: string;
  message: string;
}

/** Below this mean agreement across the signals present, a boundary is a guess (ADR-110 §1). */
export const LOW_EVIDENCE = 0.5;

function claimedTwice(kind: 'file' | 'capability', pairs: Array<[string, string]>): PortValidationError[] {
  const owner = new Map<string, string>();
  const errors: PortValidationError[] = [];
  for (const [item, domain] of pairs) {
    const first = owner.get(item);
    if (first && first !== domain) {
      errors.push({ path: `domains.${domain}`, code: `${kind}-claimed-twice`, message: `${kind} ${item} is claimed by ${first} and ${domain}` });
    } else owner.set(item, domain);
  }
  return errors;
}

export function structuralErrors(doc: Decomposition): PortValidationError[] {
  const errors: PortValidationError[] = [
    ...claimedTwice('file', doc.domains.flatMap((d) => d.files.map((f): [string, string] => [f, d.id]))),
    ...claimedTwice('capability', doc.domains.flatMap((d) => d.capabilities.map((c): [string, string] => [c.name, d.id]))),
  ];
  const shells = doc.domains.filter((d) => d.shell);
  if (shells.length > 1) errors.push({ path: 'domains', code: 'one-shell', message: `more than one shell domain: ${shells.map((d) => d.id).join(', ')}` });
  const caps = new Map(doc.domains.flatMap((d) => d.capabilities.map((c) => [c.name, d.id] as const)));
  const slots = new Set(doc.slots.map((s) => s.id));
  const placements = [
    ...doc.routes.flatMap((r) => r.place.map((p) => ({ ...p, at: `routes.${r.stateKey}` }))),
    ...doc.repeated.map((p) => ({ ...p, at: 'repeated' })),
  ];
  for (const p of placements) {
    if (caps.get(p.capability) !== p.domain) {
      errors.push({ path: p.at, code: 'placement-resolves', message: `places ${p.capability} from ${p.domain}, which has no such capability` });
    }
    if (!slots.has(p.slot)) errors.push({ path: p.at, code: 'placement-resolves', message: `places ${p.capability} into ${p.slot}, which no domain provides` });
  }
  return errors;
}

/** Port 1 over `decomposition.yaml`: the schema, the structural rules, and the derived fleet's own validation. */
export const validateDecomposition: ValidatePort<unknown> = (artifact: unknown): ValidationOutcome => {
  const parsed = DecompositionSchema.safeParse(artifact);
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: 'schema' })) };
  }
  const doc = parsed.data;
  const derived = deriveFleet(doc).validation;
  const errors = [
    ...structuralErrors(doc),
    ...Object.entries(derived.manifests).flatMap(([mfe, errs]) => errs.map((message) => ({ path: `fleet.${mfe}`, message, code: 'manifest' }))),
    ...derived.composition.map((c) => ({ path: 'fleet.composition', message: c.message, code: c.rule })),
  ];
  return { valid: errors.length === 0, errors };
};

export function stopAndAsk(doc: Decomposition): StopAndAsk[] {
  const found: StopAndAsk[] = [];
  // The shell is the frame left once the features are cut out: boundary evidence is about features.
  const features = doc.domains.filter((d) => !d.shell);
  for (const d of features) {
    const scores = Object.values(d.evidence).filter((v): v is number => typeof v === 'number');
    if (scores.length === 0) continue;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (mean < LOW_EVIDENCE) {
      found.push({ code: 'low-evidence', domain: d.id, message: `${d.id}: the signals agree ${mean.toFixed(2)} on this boundary — ask before building it` });
    }
  }
  if (features.length >= 2) {
    for (const b of new Set(features.flatMap((d) => d.backends))) {
      if (features.every((d) => d.backends.includes(b))) {
        found.push({ code: 'backend-everywhere', message: `every domain calls ${b} — a split by screen may not be a split by data; ask who owns it` });
      }
    }
  }
  for (const d of features) {
    if (d.endpoints.length === 0) continue;
    const others = new Set(doc.domains.filter((o) => o.id !== d.id).flatMap((o) => o.endpoints));
    if (d.endpoints.every((e) => others.has(e))) {
      found.push({ code: 'no-data-of-its-own', domain: d.id, message: `${d.id}: every call it makes another domain also makes — it owns no data; merge it, or ask` });
    }
  }
  return found;
}
