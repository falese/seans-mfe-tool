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

const DomainId = z.string().regex(/^[a-z][a-z0-9-]*$/, 'domain ids are lower-case kebab-case');
const Who = z.string().min(1);
/** ISO-8601; supplied by the caller so applying edits stays deterministic. */
const When = z.string().min(1);

/** Edits that change what the proposal says, or comment on it — the ones an agent may suggest (ADR-116 §4). */
const SUGGESTABLE = [
  z.object({ kind: z.literal('rename-domain'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('merge-domains'), domains: z.array(z.string()), into: z.string() }),
  z.object({ kind: z.literal('split-domain'), domain: z.string(), into: z.string(), files: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal('move-file'), file: z.string(), to: z.string() }),
  z.object({ kind: z.literal('rename-capability'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('rename-slot'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('comment'), by: Who, at: When, text: z.string().min(1), about: z.string().optional() }),
] as const;
export const SuggestableEditSchema = z.discriminatedUnion('kind', [...SUGGESTABLE]);

/**
 * What an agent answers in (ADR-117 §3): the suggestable edits, less the `by`
 * and `at` the caller signs a comment with. Derived here so the agent's schema
 * and the CLI's are one definition (ADR-118 §3).
 */
const [renameDomain, mergeDomains, splitDomain, moveFile, renameCapability, renameSlot, comment] = SUGGESTABLE;
export const AgentEditSchema = z.discriminatedUnion('kind', [
  renameDomain,
  mergeDomains,
  splitDomain,
  moveFile,
  renameCapability,
  renameSlot,
  comment.omit({ by: true, at: true }),
]);
export type AgentEdit = z.infer<typeof AgentEditSchema>;

/** Every named edit (ADR-110 §4, ADR-116 §3): the only way the document changes. */
export const EditOpSchema = z.discriminatedUnion('kind', [
  ...SUGGESTABLE,
  z.object({ kind: z.literal('suggest'), by: Who, at: When, explanation: z.string(), request: z.string().optional(), edit: SuggestableEditSchema }),
  z.object({ kind: z.literal('accept-suggestion'), id: z.string() }),
  z.object({ kind: z.literal('reject-suggestion'), id: z.string() }),
  z.object({ kind: z.literal('approve'), by: Who, at: When }),
]);
export type EditOp = z.infer<typeof EditOpSchema>;
export type SuggestableEdit = z.infer<typeof SuggestableEditSchema>;

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
  /**
   * `METHOD /path` each file calls or reads through a store, so a move or a
   * split can recompute what each domain's BFF fronts. Absent in proposals
   * written before the workspace (ADR-116).
   */
  fileEndpoints: z.record(z.string(), z.array(z.string())).optional(),
  /** The conversation about the proposal, kept with it so the PR carries it (ADR-116 §3). */
  comments: z.array(z.object({ id: z.string(), by: Who, at: When, text: z.string(), about: DomainId.optional() })).optional(),
  /** Edits an agent proposed, waiting for a person to accept or reject them (ADR-116 §4). */
  suggestions: z
    .array(z.object({ id: z.string(), by: Who, at: When, explanation: z.string(), request: z.string().optional(), edit: SuggestableEditSchema }))
    .optional(),
  /** Who approved, when, and a hash of what they approved (ADR-116 §5). */
  approval: z.object({ by: Who, at: When, hash: z.string() }).optional(),
});
export type Decomposition = z.infer<typeof DecompositionSchema>;
