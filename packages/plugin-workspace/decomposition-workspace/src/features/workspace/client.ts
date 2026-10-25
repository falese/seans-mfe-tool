/**
 * The workspace's only way to the proposal: GraphQL through this MFE's own BFF,
 * which fronts the workspace API (ADR-116 §7). Reads are `getProposal`; every
 * change is `applyEdits` — named edits, applied and validated by the CLI.
 */

import { BusinessError } from '@seans-mfe-tool/runtime';
import { query as bffQuery } from '../../platform/bff/bff';
import type { Edit, ProposalStatus } from './types';

/** The BFF connector's shape, injectable for tests. */
export type QueryFn = <T>(document: string, variables?: Record<string, unknown>) => Promise<T>;

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
    edit { kind from to domains domain into files file text about explanation id }
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

export interface WorkspaceClient {
  read(): Promise<ProposalStatus>;
  apply(edits: Edit[]): Promise<ProposalStatus>;
  /** Same-origin: the page loads nothing from another origin (decompose:workspace proxies /api). */
  screenshotUrl(path: string): string;
  /** Ask the agent; its edits arrive as suggestions. Absent when no agent is connected (ADR-117). */
  ask?(request: string): Promise<ProposalStatus>;
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
  };
}
