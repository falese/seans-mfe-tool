/**
 * `decomposition-edit` — the first prompt adaptor (ADR-117 §3).
 *
 * A plain-language request about a decomposition, plus the current
 * `decomposition.yaml`, goes in; an answer and a list of the named edits
 * `decompose:edit` already applies come out (ADR-110 §4). The schema is those
 * edits and nothing else, so the model has no other way to express a change,
 * and it cannot approve, accept or reject — those are a person's (ADR-116 §4).
 *
 * The edits mirror `SuggestableEditSchema` in the CLI's proposal model, less
 * the `by` and `at` the caller signs them with. This package does not import
 * the CLI, so the CLI's own parser checks them again when they are dry-applied.
 * That matters: the SDK's structured-output transform carries a literal `kind`
 * as a description, not a constraint, so the parse below and the dry run are
 * what actually hold the model to these kinds.
 */

import * as yaml from 'js-yaml';
import { z } from 'zod';
import type { PromptAdaptor } from '../api-runner';

export const AgentEditSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rename-domain'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('merge-domains'), domains: z.array(z.string()), into: z.string() }),
  z.object({ kind: z.literal('split-domain'), domain: z.string(), into: z.string(), files: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal('move-file'), file: z.string(), to: z.string() }),
  z.object({ kind: z.literal('rename-capability'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('rename-slot'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('comment'), text: z.string().min(1), about: z.string().optional() }),
]);
export type AgentEdit = z.infer<typeof AgentEditSchema>;

export const AGENT_EDIT_KINDS: readonly AgentEdit['kind'][] = [
  'rename-domain',
  'merge-domains',
  'split-domain',
  'move-file',
  'rename-capability',
  'rename-slot',
  'comment',
];

export const DecompositionEditAnswerSchema = z.object({
  /** What the agent says back, in a few sentences; recorded in the proposal's conversation. */
  answer: z.string(),
  edits: z.array(z.object({ explanation: z.string(), edit: AgentEditSchema })),
});
export type DecompositionEditAnswer = z.infer<typeof DecompositionEditAnswerSchema>;

export interface DecompositionEditInput {
  /** The proposal as `decompose:status` returns it. */
  document: unknown;
  request: string;
}

const SYSTEM = `You help a product owner shape a proposal for breaking a monolithic web app into independently deployable domains (micro-frontends, each with its own backend-for-frontend).

The proposal is a decomposition.yaml document. You will be given all of it: each domain with its files, capabilities (screens), backends, endpoints, and the evidence behind it — a 0–1 score per signal and the reasons; the files several domains share; couplings (one domain reading another's data); where each capability is placed on each route; the triage of the existing tests; and the conversation so far.

You answer a request in two parts:
- answer: a few plain sentences for the product owner. Say what you suggest and why, using the evidence. If the request is a question, answer it. If it asks for something that would make the proposal worse, say so and why. If nothing should change, say that and suggest no edits.
- edits: the changes you suggest, each with a one-sentence explanation. Each is exactly one of these named edits, and these are the only changes you can make:
  - rename-domain {from, to}: rename a domain; its MFE, routes, slots and tests follow. Domain ids are lower-case kebab-case.
  - merge-domains {domains, into}: merge two or more domains into one, which carries all their files, capabilities, backends and placements.
  - split-domain {domain, into, files}: move the listed files, with the capabilities, placements and couplings they hold, out of a domain into a new one. Every file must be one of that domain's files.
  - move-file {file, to}: move one file to another domain, or to "shared".
  - rename-capability {from, to}: rename a capability (PascalCase).
  - rename-slot {from, to}: rename a slot.
  - comment {text, about?}: leave a note in the conversation, about a domain if it concerns one.

Rules:
- Use only domain ids, file paths, capability names and slot ids that appear in the document.
- Each edit must stand on its own: a person accepts or rejects each one separately, in any order. So split straight into the name you want, rather than splitting and then renaming.
- Do not repeat an edit already waiting in the document's suggestions.
- Suggest the fewest edits that do what was asked. Do not tidy, rename or reorganize anything that was not asked about.
- Nothing you suggest changes the proposal. Each edit is checked by applying it and validating the fleet it derives; any that fail are dropped. The rest wait until a person accepts or rejects them, one by one.`;

export const decompositionEdit: PromptAdaptor<DecompositionEditInput, DecompositionEditAnswer> = {
  id: 'decomposition-edit',
  version: '2',
  system: SYSTEM,
  assemble: ({ document, request }) => ({
    context: `The proposal, decomposition.yaml:\n\n${yaml.dump(document, { lineWidth: 160, noRefs: true })}`,
    request: `The product owner asks:\n\n${request}`,
  }),
  output: DecompositionEditAnswerSchema,
};
