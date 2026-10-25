/**
 * The workspace's view of a proposal: what `decompose:status` returns through
 * the workspace API (ADR-116 §3). Only the fields the screens read are typed;
 * the document carries more.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Domain {
  id: string;
  mfe: string;
  shell: boolean;
  files: string[];
  capabilities: Array<{ name: string; file: string; component: string }>;
  backends: string[];
  endpoints: string[];
  evidence: Record<string, number | null>;
  reasons: string[];
}

export interface Coupling {
  file: string;
  domain: string;
  field: string;
  endpoint: string;
  owner: string;
  kind: string;
  note: string;
}

export interface Comment {
  id: string;
  by: string;
  at: string;
  text: string;
  about?: string;
}

/** A named edit (ADR-110 §4), in the CLI's spelling; the client maps kinds to GraphQL enum values. */
export interface Edit {
  kind:
    | 'rename-domain'
    | 'merge-domains'
    | 'split-domain'
    | 'move-file'
    | 'rename-capability'
    | 'rename-slot'
    | 'comment'
    | 'suggest'
    | 'accept-suggestion'
    | 'reject-suggestion'
    | 'approve';
  from?: string;
  to?: string;
  domains?: string[];
  domain?: string;
  into?: string;
  files?: string[];
  file?: string;
  text?: string;
  about?: string;
  explanation?: string;
  request?: string;
  edit?: Edit;
  id?: string;
}

export interface Suggestion {
  id: string;
  by: string;
  at: string;
  explanation: string;
  request?: string;
  edit: Edit;
  check: { ok: boolean; errors: string[]; domains: string[] };
}

export interface Screen {
  id: string;
  path: string;
  screenshot: string;
  width: number;
  height: number;
  boxes: Array<{ domain: string; mfe: string; capability: string; slot: string; label: string; color: string; rect: Rect }>;
  couplings: Array<{ file: string; label: string; rect: Rect }>;
}

export interface ProposalStatus {
  proposal: string;
  bundle: string | null;
  app: { name: string; namespace: string };
  approval: { status: 'none' | 'current' | 'stale'; by?: string; at?: string; hash?: string };
  valid: boolean;
  validation: { manifests: Record<string, string[]>; composition: Array<{ rule: string; message: string }> };
  suggestions: Suggestion[];
  document: {
    domains: Domain[];
    shared: Array<{ file: string; usedBy: string[]; suggestion: string }>;
    couplings: Coupling[];
    comments?: Comment[];
  };
  screens: { screens: Screen[]; legend: Array<{ domain: string; mfe: string; color: string }> } | null;
}

/** Whether an agent answers questions here (ADR-117), and if not, why. */
export interface AgentInfo {
  connected: boolean;
  model?: string;
  reason?: string;
}

export interface CheckedEdit {
  explanation: string;
  edit: Edit;
  /** Why the check dropped it. */
  reason?: string;
}

/** One answer from the agent: its edits that passed the check are now suggestions. */
export interface AskResult {
  answer: string;
  suggested: CheckedEdit[];
  dropped: CheckedEdit[];
  model: string;
}
