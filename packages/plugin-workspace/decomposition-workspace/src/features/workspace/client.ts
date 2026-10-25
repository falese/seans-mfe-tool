/**
 * The workspace's only way to the proposal: GraphQL through this MFE's own BFF,
 * which fronts the workspace API (ADR-116 §7). Reads are `getProposal`; every
 * change is `applyEdits` — named edits, applied and validated by the CLI. A
 * question to the agent is `askAgent`; what it suggests arrives as pending
 * suggestions in the next read (ADR-117).
 */

import { BusinessError } from '@seans-mfe-tool/runtime';
import { query as bffQuery } from '../../platform/bff/bff';
import type { AgentInfo, AskResult, CheckedEdit, Edit, ProposalStatus } from './types';

/** The BFF connector's shape, injectable for tests. */
export type QueryFn = <T>(document: string, variables?: Record<string, unknown>) => Promise<T>;

const EDIT_FIELDS = 'kind from to domains domain into files file text about explanation id';

const STATUS_FIELDS = `
  proposal
  bundle
  app { name namespace }
  approval { status by at hash }
  valid
  validation
  document
  suggestions {
    id by at explanation request
    edit { ${EDIT_FIELDS} }
    check { ok errors domains }
  }
  screens {
    screens {
      id path screenshot width height
      boxes { domain mfe capability slot label color rect { x y width height } }
      couplings { file label rect { x y width height } }
    }
    legend { domain mfe color }
  }
`;

export const GET_PROPOSAL = `
  query GetProposal {
    getProposal {
      __typename
      ... on ProposalStatus { ${STATUS_FIELDS} }
      ... on Problem { message }
    }
  }
`;

export const APPLY_EDITS = `
  mutation ApplyEdits($edits: [EditInput]!) {
    applyEdits(input: { edits: $edits }) {
      __typename
      ... on ProposalStatus { ${STATUS_FIELDS} }
      ... on Problem { message }
    }
  }
`;

export const GET_AGENT = `
  query GetAgent {
    getAgent { connected model reason }
  }
`;

export const ASK_AGENT = `
  mutation AskAgent($request: String!) {
    askAgent(input: { request: $request }) {
      __typename
      ... on AskResult {
        answer model
        suggested { explanation reason edit { ${EDIT_FIELDS} } }
        dropped { explanation reason edit { ${EDIT_FIELDS} } }
      }
      ... on Problem { message }
    }
  }
`;

type Answer = ({ __typename: 'ProposalStatus' } & ProposalStatus) | { __typename: 'Problem'; message: string };

/** GraphQL enum values cannot hold '-', so Mesh spells `rename-domain` as `rename_domain`. */
export function toEditInput(edit: Edit): Record<string, unknown> {
  const out: Record<string, unknown> = { ...edit, kind: edit.kind.replace(/-/g, '_') };
  if (edit.edit) out.edit = toEditInput(edit.edit);
  return out;
}

/** The reverse, for edits read back from the document. */
export const fromEnumKind = (kind: string): Edit['kind'] => kind.replace(/_/g, '-') as Edit['kind'];

function unwrap(answer: Answer | undefined): ProposalStatus {
  if (!answer) throw new BusinessError('the workspace API returned nothing', 'WORKSPACE_EMPTY');
  if (answer.__typename === 'Problem') throw new BusinessError(answer.message, 'WORKSPACE_PROBLEM');
  const { __typename: _t, ...status } = answer;
  return {
    ...status,
    suggestions: status.suggestions.map((s) => ({ ...s, edit: { ...s.edit, kind: fromEnumKind(s.edit.kind) } })),
  };
}

/** GraphQL answers null for a field the API left out; the workspace's types leave it out too. */
function present<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
}

const readEdit = (c: CheckedEdit): CheckedEdit => present({ ...c, edit: present({ ...c.edit, kind: fromEnumKind(c.edit.kind) }) });

type AskAnswer = ({ __typename: 'AskResult' } & AskResult) | { __typename: 'Problem'; message: string };

export interface WorkspaceClient {
  read(): Promise<ProposalStatus>;
  apply(edits: Edit[]): Promise<ProposalStatus>;
  /** Same-origin: the page loads nothing from another origin (decompose:workspace proxies /api). */
  screenshotUrl(path: string): string;
  /** Whether an agent is connected (ADR-117). */
  agent(): Promise<AgentInfo>;
  /** Ask the agent; the edits that pass the check arrive as suggestions. */
  ask(request: string): Promise<AskResult>;
}

export function createWorkspaceClient(query: QueryFn = bffQuery as QueryFn): WorkspaceClient {
  return {
    async read() {
      return unwrap((await query<{ getProposal: Answer }>(GET_PROPOSAL)).getProposal);
    },
    async apply(edits) {
      return unwrap((await query<{ applyEdits: Answer }>(APPLY_EDITS, { edits: edits.map(toEditInput) })).applyEdits);
    },
    screenshotUrl(path) {
      return `/api/screenshot?path=${encodeURIComponent(path)}`;
    },
    async agent() {
      return present((await query<{ getAgent: AgentInfo }>(GET_AGENT)).getAgent);
    },
    async ask(request) {
      const answer = (await query<{ askAgent: AskAnswer }>(ASK_AGENT, { request })).askAgent;
      if (!answer) throw new BusinessError('the workspace API returned nothing', 'WORKSPACE_EMPTY');
      if (answer.__typename === 'Problem') throw new BusinessError(answer.message, 'AGENT_PROBLEM');
      const { __typename: _t, ...result } = answer;
      return { ...result, suggested: result.suggested.map(readEdit), dropped: result.dropped.map(readEdit) };
    },
  };
}
