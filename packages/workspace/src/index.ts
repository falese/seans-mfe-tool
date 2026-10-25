/**
 * @seans-mfe/workspace — the decomposition workspace (ADR-116), as a library
 * (ADR-118 §4): the workspace API, the runner that serves the generated
 * workspace MFE standalone, and the approval commit. `decompose:workspace` is
 * the core command that starts it.
 */

export { createWorkspaceHandler, startWorkspaceApi, SPEC_PATH } from './api/server';
export type { RunningApi, WorkspaceAgent, WorkspaceApiOptions } from './api/server';
export { API_PORT, BFF_PORT, MFE_DIR, buildMfe, portIsFree, preflight, startWorkspace, whoIsApproving } from './run/workspace';
export type { ChildEnv, Preflight, RunningWorkspace, WorkspaceOptions } from './run/workspace';
export type { CommitResult } from './run/git';
