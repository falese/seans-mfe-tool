/**
 * ShapeProposal — merge, split, rename and move, each a named edit (ADR-116 §3).
 */

import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkspaceProvider } from '../workspace/WorkspaceContext';
import { fakeClient } from '../workspace/testing/fakeClient';
import { ShapeProposal } from './ShapeProposal';

async function renderShape(client = fakeClient()) {
  render(
    <WorkspaceProvider client={client}>
      <ShapeProposal />
    </WorkspaceProvider>
  );
  await screen.findByRole('group', { name: 'Rename a domain' });
  return client;
}

const pick = (group: string, label: string, value: string) =>
  fireEvent.change(within(screen.getByRole('group', { name: group })).getByLabelText(label), { target: { value } });
const press = async (group: string, button: string) =>
  act(async () => fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name: button })));

describe('ShapeProposal', () => {
  beforeEach(() => jest.useRealTimers());

  it('renames a domain', async () => {
    const client = await renderShape();
    pick('Rename a domain', 'Domain', 'cargo');
    pick('Rename a domain', 'New name', 'freight');
    await press('Rename a domain', 'Rename');
    expect(client.applied).toEqual([[{ kind: 'rename-domain', from: 'cargo', to: 'freight' }]]);
  });

  it('merges the domains you tick into one', async () => {
    const client = await renderShape();
    const group = within(screen.getByRole('group', { name: 'Merge domains' }));
    fireEvent.click(group.getByLabelText('cargo'));
    fireEvent.click(group.getByLabelText('docking'));
    pick('Merge domains', 'Into', 'harbor');
    await press('Merge domains', 'Merge');
    expect(client.applied).toEqual([[{ kind: 'merge-domains', domains: ['cargo', 'docking'], into: 'harbor' }]]);
  });

  it('splits the files you tick out of a domain', async () => {
    const client = await renderShape();
    pick('Split a domain', 'Domain', 'cargo');
    fireEvent.click(within(screen.getByRole('group', { name: 'Split a domain' })).getByLabelText('src/pages/cargo/HazardSummary.tsx'));
    pick('Split a domain', 'New domain', 'hazmat');
    await press('Split a domain', 'Split');
    expect(client.applied).toEqual([[{ kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['src/pages/cargo/HazardSummary.tsx'] }]]);
  });

  it('moves a file, a shared one included, to a domain', async () => {
    const client = await renderShape();
    pick('Move a file', 'File', 'src/utils/constants.ts');
    pick('Move a file', 'To', 'shell');
    await press('Move a file', 'Move');
    expect(client.applied).toEqual([[{ kind: 'move-file', file: 'src/utils/constants.ts', to: 'shell' }]]);
  });

  it('shows why an edit was refused, and keeps the form as it was', async () => {
    await renderShape(fakeClient({ apply: jest.fn().mockRejectedValue(new Error('domain "docking" already exists — merge instead')) }));
    pick('Rename a domain', 'Domain', 'cargo');
    pick('Rename a domain', 'New name', 'docking');
    await press('Rename a domain', 'Rename');
    expect(screen.getByRole('alert')).toHaveTextContent('domain "docking" already exists — merge instead');
    expect(within(screen.getByRole('group', { name: 'Rename a domain' })).getByLabelText('New name')).toHaveValue('docking');
  });

  it('will not send an edit with a part missing', async () => {
    await renderShape();
    pick('Rename a domain', 'Domain', 'cargo');
    expect(within(screen.getByRole('group', { name: 'Rename a domain' })).getByRole('button', { name: 'Rename' })).toBeDisabled();
  });
});
