/**
 * AgentPane — the agent's suggested edits, held until a person decides (ADR-116 §4, ADR-117 §4).
 */

import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkspaceProvider } from '../workspace/WorkspaceContext';
import { fakeClient } from '../workspace/testing/fakeClient';
import { fixtureStatus } from '../workspace/testing/fixture';
import { describeEdit } from '../workspace/describe';
import { AgentPane } from './AgentPane';

const withSuggestions = () =>
  fixtureStatus({
    suggestions: [
      { id: 's1', by: 'agent', at: 't', explanation: 'One harbor team owns both', request: 'combine the harbor screens', edit: { kind: 'merge-domains', domains: ['docking', 'cargo'], into: 'harbor' }, check: { ok: true, errors: [], domains: ['shell', 'harbor'] } },
      { id: 's2', by: 'agent', at: 't', explanation: 'People is clearer', edit: { kind: 'rename-domain', from: 'crew', to: 'people' }, check: { ok: false, errors: ['no domain "crew" in the proposal'], domains: [] } },
    ],
  });

async function renderPane(client = fakeClient({ read: jest.fn().mockResolvedValue(withSuggestions()) })) {
  render(
    <WorkspaceProvider client={client}>
      <AgentPane />
    </WorkspaceProvider>
  );
  await screen.findByText('Suggestions');
  return client;
}

describe('describeEdit', () => {
  it('says each edit in words a product owner reads', () => {
    expect(describeEdit({ kind: 'merge-domains', domains: ['docking', 'cargo'], into: 'harbor' })).toBe('Merge docking and cargo into harbor');
    expect(describeEdit({ kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['a/HazardSummary.tsx', 'a/Labels.tsx'] })).toBe('Split HazardSummary.tsx, Labels.tsx out of cargo into hazmat');
    expect(describeEdit({ kind: 'rename-domain', from: 'crew', to: 'people' })).toBe('Rename crew to people');
    expect(describeEdit({ kind: 'move-file', file: 'src/utils/constants.ts', to: 'shell' })).toBe('Move constants.ts to shell');
    expect(describeEdit({ kind: 'comment', text: 'hi', about: 'cargo' })).toBe('Comment on cargo: “hi”');
  });
});

describe('AgentPane', () => {
  beforeEach(() => jest.useRealTimers());

  it('lists each suggestion in words, with what was asked and whether it still works', async () => {
    await renderPane();
    const first = screen.getByRole('article', { name: 'Suggestion s1' });
    expect(first).toHaveTextContent('Merge docking and cargo into harbor');
    expect(first).toHaveTextContent('One harbor team owns both');
    expect(first).toHaveTextContent('combine the harbor screens');
    expect(first).toHaveTextContent('Checks out');
    const second = screen.getByRole('article', { name: 'Suggestion s2' });
    expect(second).toHaveTextContent('no domain "crew" in the proposal');
    expect(within(second).getByRole('button', { name: 'Accept' })).toBeDisabled();
  });

  it('accepts or rejects a suggestion as a named edit', async () => {
    const applied: unknown[] = [];
    const client = await renderPane(
      fakeClient({
        read: jest.fn().mockResolvedValue(withSuggestions()),
        apply: jest.fn().mockImplementation(async (edits) => {
          applied.push(edits);
          return withSuggestions();
        }),
      })
    );
    await act(async () => fireEvent.click(within(screen.getByRole('article', { name: 'Suggestion s1' })).getByRole('button', { name: 'Accept' })));
    await act(async () => fireEvent.click(within(screen.getByRole('article', { name: 'Suggestion s2' })).getByRole('button', { name: 'Reject' })));
    expect(applied).toEqual([[{ kind: 'accept-suggestion', id: 's1' }], [{ kind: 'reject-suggestion', id: 's2' }]]);
    expect(client.apply).toHaveBeenCalledTimes(2);
  });

  it('says plainly when there is nothing waiting', async () => {
    await renderPane(fakeClient());
    expect(screen.getByText(/No suggestions waiting/)).toBeInTheDocument();
  });

  it('asks the agent when one is connected, and says so when none is', async () => {
    await renderPane(fakeClient());
    expect(screen.getByRole('textbox', { name: 'Ask the agent' })).toBeDisabled();
    expect(screen.getByText(/No agent is connected/)).toBeInTheDocument();
  });
});
