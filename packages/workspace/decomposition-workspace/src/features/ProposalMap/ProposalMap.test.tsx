/**
 * ProposalMap — the captured screens with each proposed domain outlined (ADR-116).
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceProvider } from '../workspace/WorkspaceContext';
import { fakeClient } from '../workspace/testing/fakeClient';
import { fixtureStatus } from '../workspace/testing/fixture';
import { ProposalMap } from './ProposalMap';

const renderMap = (client = fakeClient()) =>
  render(
    <WorkspaceProvider client={client}>
      <ProposalMap />
    </WorkspaceProvider>
  );

describe('ProposalMap', () => {
  beforeEach(() => jest.useRealTimers());

  it('shows each captured screen with a box per domain, over its screenshot from the same origin', async () => {
    renderMap();
    expect(await screen.findByRole('tab', { name: '/cargo' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Screen /cargo' })).toHaveAttribute('src', '/api/screenshot?path=screens/j.0.png');
    expect(screen.getByRole('button', { name: 'cargo · meridian-ops-cargo · main' })).toBeInTheDocument();
    expect(screen.getByText('coupling: cargo reads docking’s dockings')).toBeInTheDocument();
  });

  it('explains the boundary of the domain you pick: its files, its data, its evidence and what it reads from others', async () => {
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: 'cargo · meridian-ops-cargo · main' }));
    const panel = screen.getByRole('region', { name: 'Domain cargo' });
    expect(panel).toHaveTextContent('meridian-ops-cargo');
    expect(panel).toHaveTextContent('src/pages/cargo/HazardSummary.tsx');
    expect(panel).toHaveTextContent('harbormaster, ledger');
    expect(panel).toHaveTextContent('route /cargo fills the main area');
    expect(panel).toHaveTextContent('HazardSummary.tsx reads docking’s dockings');
    expect(panel).toHaveTextContent('route 1.00');
  });

  it('picks a domain from the legend too, including one no screen shows', async () => {
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: 'docking' }));
    expect(screen.getByRole('region', { name: 'Domain docking' })).toHaveTextContent('GET /api/harbormaster/dockings');
  });

  it('says so when there is no evidence bundle to draw', async () => {
    renderMap(fakeClient({ read: jest.fn().mockResolvedValue(fixtureStatus({ screens: null })) }));
    expect(await screen.findByText(/No captured screens/)).toBeInTheDocument();
  });
});
