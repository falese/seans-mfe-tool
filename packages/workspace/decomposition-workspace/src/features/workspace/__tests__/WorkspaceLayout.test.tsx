import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceLayout } from '../WorkspaceLayout';
import { fakeClient } from '../testing/fakeClient';
import { fixtureStatus } from '../testing/fixture';

describe('WorkspaceLayout — the standalone page', () => {
  beforeEach(() => jest.useRealTimers());

  it('heads the page with the proposal, its validity and its approval, and puts the map beside the tools', async () => {
    render(<WorkspaceLayout client={fakeClient({ read: jest.fn().mockResolvedValue(fixtureStatus({ approval: { status: 'stale', by: 'pat', at: 't' } })) })} />);
    const header = await screen.findByRole('banner');
    expect(header).toHaveTextContent('meridian-ops');
    expect(header).toHaveTextContent('3 domains');
    expect(header).toHaveTextContent('Valid');
    expect(header).toHaveTextContent('Approval out of date');
    expect(screen.getByRole('tablist', { name: 'Captured screens' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Rename a domain' })).toBeInTheDocument();
  });

  it('switches the side panel between shaping, the agent and approval, on one shared proposal', async () => {
    const client = fakeClient();
    render(<WorkspaceLayout client={client} />);
    await screen.findByRole('banner');
    fireEvent.click(screen.getByRole('tab', { name: 'Agent' }));
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: 'Approve this proposal' })).toBeInTheDocument();
    expect(client.read).toHaveBeenCalledTimes(1);
  });
});
