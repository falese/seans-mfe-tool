import '@testing-library/jest-dom';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceProvider, useWorkspace, withWorkspace } from '../WorkspaceContext';
import { fakeClient } from '../testing/fakeClient';

const Probe: React.FC = () => {
  const ws = useWorkspace();
  return (
    <div>
      <span>{ws.status ? `${ws.status.app.name} · ${ws.status.approval.status}` : 'loading'}</span>
      <span>{ws.error ?? 'no error'}</span>
      <button onClick={() => void ws.apply([{ kind: 'approve' }])}>approve</button>
    </div>
  );
};

describe('WorkspaceProvider (ADR-116 §3: the document is the only state)', () => {
  beforeEach(() => jest.useRealTimers());

  it('loads the proposal, and replaces it with what an edit returns', async () => {
    const client = fakeClient();
    render(<WorkspaceProvider client={client}><Probe /></WorkspaceProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await screen.findByText('meridian-ops · none');
    await act(async () => screen.getByText('approve').click());
    await screen.findByText('meridian-ops · current');
    expect(client.applied).toEqual([[{ kind: 'approve' }]]);
  });

  it('keeps the proposal and shows the reason when an edit is refused', async () => {
    const client = fakeClient({ apply: jest.fn().mockRejectedValue(new Error('no domain "crew" in the proposal')) });
    render(<WorkspaceProvider client={client}><Probe /></WorkspaceProvider>);
    await screen.findByText('meridian-ops · none');
    await act(async () => screen.getByText('approve').click());
    await screen.findByText('no domain "crew" in the proposal');
    expect(screen.getByText('meridian-ops · none')).toBeInTheDocument();
  });

  it('lets a capability mounted alone by a shell bring its own provider, and share one when composed', async () => {
    const client = fakeClient();
    const Wrapped = withWorkspace(Probe, () => client);
    render(<Wrapped />);
    await screen.findByText('meridian-ops · none');
    render(<WorkspaceProvider client={client}><Wrapped /><Wrapped /></WorkspaceProvider>);
    await waitFor(() => expect(screen.getAllByText('meridian-ops · none')).toHaveLength(3));
    // One read for the lone capability, one for the shared provider — not one per capability.
    expect(client.read).toHaveBeenCalledTimes(2);
  });
});
