/**
 * `decomposition.yaml` — the proposal humans and the agent agree on (ADR-110).
 *
 * It is written at the level of the decision: domains, the files and
 * capabilities each owns, the backends each fronts, the slots and routes that
 * compose them, and the evidence behind each boundary. Manifests and the
 * composition are derived from it (`derive.ts`); edits go here, never to the
 * derived files (ADR-110 §4).
 */

import { z } from 'zod';

const Score = z.number().min(0).max(1).nullable();

export const DomainSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'domain ids are lower-case kebab-case'),
  mfe: z.string().regex(/^[a-z][a-z0-9-]*$/, 'MFE names are lower-case kebab-case'),
  /** The domain that provides the layout everything else composes into. */
  shell: z.boolean().default(false),
  files: z.array(z.string()),
  capabilities: z.array(z.object({ name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/), file: z.string(), component: z.string() })),
  /** Backend ids (the API path segment the app calls them under). */
  backends: z.array(z.string()),
  /** `METHOD /path` the domain's files call, directly or through a store. */
  endpoints: z.array(z.string()),
  /** Per-signal agreement with this boundary, 0–1; null where the signal is absent. */
  evidence: z.object({
    route: Score,
    data: Score,
    imports: Score,
    runtime: Score,
    cochange: Score,
    ownership: Score,
  }),
  reasons: z.array(z.string()),
});
export type Domain = z.infer<typeof DomainSchema>;

export const PlacementSchema = z.object({ capability: z.string(), domain: z.string(), slot: z.string() });

export const DecompositionSchema = z.object({
  version: z.literal(1),
  app: z.object({
    name: z.string().min(1),
    /** The control-plane namespace the derived composition owns (ADR-083). */
    namespace: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
    /**
     * How the app's API URLs name backends: `/api/<backend>/<resource>` (a
     * gateway) or `/api/<resource>` (one API). Judged by `backendLayout`.
     */
    gateway: z.boolean().default(true),
  }),
  domains: z.array(DomainSchema).min(1),
  /** Files several domains use; each needs splitting, duplicating or replacing, not an owner. */
  shared: z.array(z.object({ file: z.string(), usedBy: z.array(z.string()), suggestion: z.string() })),
  /** Files no entry or route reaches. */
  unassigned: z.array(z.string()),
  /** A domain reading another domain's data through a shared store or the shell. */
  couplings: z.array(
    z.object({
      file: z.string(),
      domain: z.string(),
      field: z.string(),
      endpoint: z.string(),
      owner: z.string(),
      kind: z.enum(['store-read', 'shell-read']),
      note: z.string(),
    })
  ),
  slots: z.array(z.object({ id: z.string(), provider: z.string(), repeated: z.boolean() })),
  routes: z.array(z.object({ path: z.string(), stateKey: z.string(), place: z.array(PlacementSchema) })),
  /** Placements made by the shell for each item of a list (one tile per berth): bound when composed. */
  repeated: z.array(PlacementSchema.extend({ renderedBy: z.string() })),
  tests: z.array(
    z.object({
      file: z.string(),
      domain: z.string().nullable(),
      verdict: z.enum(['keep', 'rewrite', 'discard']),
      reasons: z.array(z.string()),
    })
  ),
  /** Capabilities no kept test exercises. */
  uncovered: z.array(z.object({ capability: z.string(), domain: z.string(), file: z.string(), reason: z.string() })),
});
export type Decomposition = z.infer<typeof DecompositionSchema>;
