/**
 * `decomposition-edit` — the first prompt adaptor (ADR-117 §3).
 *
 * A plain-language request about a decomposition, plus the current
 * `decomposition.yaml`, goes in; an answer and a list of the named edits
 * `decompose:edit` already applies come out (ADR-110 §4). The schema is those
 * edits and nothing else, so the model has no other way to express a change,
 * and it cannot approve, accept or reject — those are a person's (ADR-116 §4).
 *
 * The edits are `AgentEditSchema` from `@seans-mfe/decompose`: one definition
 * for the CLI, the workspace and the model (ADR-118 §3). The SDK's
 * structured-output transform carries a literal `kind` as a description, not a
 * constraint, so the parse in `runPromptAdaptor` and the dry run in
 * `askAgent` are what hold the model to these kinds.
 */

import * as yaml from 'js-yaml';
import { z } from 'zod';
import { AgentEditSchema, type AgentModel, type Decomposition } from '@seans-mfe/decompose';
import { runPromptAdaptor, type MessagesClient, type PromptAdaptor } from '../api-runner';

export const AGENT_EDIT_KINDS = AgentEditSchema.options.map((o) => o.shape.kind.value);

export const DecompositionEditAnswerSchema = z.object({
  /** What the agent says back, in a few sentences; recorded in the proposal's conversation. */
  answer: z.string(),
  edits: z.array(z.object({ explanation: z.string(), edit: AgentEditSchema })),
});
export type DecompositionEditAnswer = z.infer<typeof DecompositionEditAnswerSchema>;

export interface DecompositionEditInput {
  document: Decomposition;
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

/** The adaptor as the model `askAgent` takes (`@seans-mfe/decompose`). */
export function decompositionEditModel(opts: { client: MessagesClient; model?: string }): AgentModel {
  return (input) => runPromptAdaptor(decompositionEdit, input, opts);
}
