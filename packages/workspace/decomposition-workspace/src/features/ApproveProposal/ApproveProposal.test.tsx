/**
 * ApproveProposal — the summary a product owner approves, and the approval (ADR-116 §5).
 */

import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceProvider } from '../workspace/WorkspaceContext';
import { fakeClient } from '../workspace/testing/fakeClient';
import { fixtureStatus } from '../workspace/testing/fixture';
import { ApproveProposal } from './ApproveProposal';
import type { ProposalStatus } from '../workspace/types';

async function renderApprove(status: ProposalStatus = fixtureStatus()) {
  const client = fakeClient({ read: jest.fn().mockResolvedValue(status) });
  render(
    <WorkspaceProvider client={client}>
      <ApproveProposal />
    </WorkspaceProvider>
  );
  await screen.findByRole('table', { name: 'Proposed domains' });
  return client;
}

describe('ApproveProposal', () => {
  beforeEach(() => jest.useRealTimers());

  it('summarises what is being approved: each domain, its MFE and data, and the open risks', async () => {
    await renderApprove();
    const table = screen.getByRole('table', { name: 'Proposed domains' });
    expect(table).toHaveTextContent('cargo');
    expect(table).toHaveTextContent('meridian-ops-cargo');
    expect(table).toHaveTextContent('harbormaster, ledger');
    expect(screen.getByText('1 coupling to resolve')).toBeInTheDocument();
    expect(screen.getByText('1 shared file to place')).toBeInTheDocument();
    expect(screen.getByText('Every derived manifest and the composition validate')).toBeInTheDocument();
  });

  it('records an approval, and shows who approved and when', async () => {
    const client = await renderApprove();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve this proposal' })));
    expect(client.applied).toEqual([[{ kind: 'approve' }]]);
    // The fake answers with an approval by sean.
    expect(await screen.findByText(/Approved by sean/)).toBeInTheDocument();
  });

  it('says an approval is out of date when the proposal changed after it', async () => {
    await renderApprove(fixtureStatus({ approval: { status: 'stale', by: 'pat', at: '2026-10-25T12:00:00Z' } }));
    expect(screen.getByText(/changed after pat approved it/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve this proposal' })).toBeEnabled();
  });

  it('will not approve a proposal that does not validate, and says why', async () => {
    await renderApprove(fixtureStatus({ valid: false, validation: { manifests: { 'meridian-ops-cargo': ['capabilities: required'] }, composition: [] } }));
    expect(screen.getByRole('button', { name: 'Approve this proposal' })).toBeDisabled();
    expect(screen.getByText('meridian-ops-cargo: capabilities: required')).toBeInTheDocument();
  });

  it('shows the conversation and adds to it', async () => {
    const status = fixtureStatus();
    status.document.comments = [{ id: 'c1', by: 'pat', at: '2026-10-25T11:00:00Z', text: 'Hazards feel separate', about: 'cargo' }];
    const client = await renderApprove(status);
    expect(screen.getByText('Hazards feel separate')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Agreed, keep them together for now' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Comment' })));
    expect(client.applied).toEqual([[{ kind: 'comment', text: 'Agreed, keep them together for now' }]]);
  });
});
