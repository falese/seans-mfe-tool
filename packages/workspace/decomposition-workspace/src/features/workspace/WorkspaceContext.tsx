/**
 * One live copy of the proposal for every screen on the page.
 *
 * The workspace keeps no state of its own (ADR-116 §3): this holds only the
 * last `ProposalStatus` the API returned. Every change goes out as named edits
 * and the answer replaces it whole, so a reload shows exactly the same thing.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SystemError } from '@seans-mfe-tool/runtime';
import { createWorkspaceClient, type WorkspaceClient } from './client';
import type { Edit, ProposalStatus } from './types';

export interface Workspace {
  status: ProposalStatus | null;
  /** The last refusal or failure, in words; cleared by the next success. */
  error: string | null;
  busy: boolean;
  /** Apply edits in order, all or none. Resolves true when they applied. */
  apply(edits: Edit[]): Promise<boolean>;
  refresh(): Promise<void>;
  client: WorkspaceClient;
}

const Ctx = createContext<Workspace | null>(null);

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const WorkspaceProvider: React.FC<{ client?: WorkspaceClient; children?: React.ReactNode }> = ({ client, children }) => {
  const api = useMemo(() => client ?? createWorkspaceClient(), [client]);
  const [status, setStatus] = useState<ProposalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.read());
      setError(null);
    } catch (err) {
      setError(message(err));
    }
  }, [api]);

  const apply = useCallback(
    async (edits: Edit[]) => {
      setBusy(true);
      try {
        setStatus(await api.apply(edits));
        setError(null);
        return true;
      } catch (err) {
        setError(message(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [api]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ status, error, busy, apply, refresh, client: api }), [status, error, busy, apply, refresh, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useWorkspace(): Workspace {
  const ws = useContext(Ctx);
  if (!ws) throw new SystemError('useWorkspace() needs a <WorkspaceProvider> above it — capabilities get one from withWorkspace()');
  return ws;
}

/**
 * A capability works alone, mounted by a shell, and beside the others in the
 * standalone page: it brings its own provider only when none is above it.
 */
export function withWorkspace<P extends object>(Component: React.ComponentType<P>, makeClient?: () => WorkspaceClient): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => {
    const outer = useContext(Ctx);
    if (outer) return <Component {...props} />;
    return (
      <WorkspaceProvider client={makeClient?.()}>
        <Component {...props} />
      </WorkspaceProvider>
    );
  };
  Wrapped.displayName = `withWorkspace(${Component.displayName ?? Component.name})`;
  return Wrapped;
}
