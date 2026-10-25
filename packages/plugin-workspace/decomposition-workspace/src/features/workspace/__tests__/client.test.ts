import { createWorkspaceClient, toEditInput } from '../client';
import { fixtureStatus } from '../testing/fixture';

describe('the workspace client (ADR-116)', () => {
  it('reads the proposal through the BFF and unwraps the ProposalStatus', async () => {
    const query = jest.fn().mockResolvedValue({ getProposal: { __typename: 'ProposalStatus', ...fixtureStatus() } });
    const status = await createWorkspaceClient(query).read();
    expect(status.app.name).toBe('meridian-ops');
    expect(query.mock.calls[0][0]).toContain('getProposal');
  });

  it('turns a Problem into a thrown error carrying its message', async () => {
    const query = jest.fn().mockResolvedValue({ applyEdits: { __typename: 'Problem', message: 'no domain "crew" in the proposal' } });
    await expect(createWorkspaceClient(query).apply([{ kind: 'rename-domain', from: 'crew', to: 'people' }])).rejects.toThrow('no domain "crew" in the proposal');
  });

  it('sends edits with GraphQL enum kinds, nested suggestion edits included', async () => {
    const query = jest.fn().mockResolvedValue({ applyEdits: { __typename: 'ProposalStatus', ...fixtureStatus() } });
    await createWorkspaceClient(query).apply([
      { kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['a.tsx'] },
      { kind: 'suggest', explanation: 'x', edit: { kind: 'merge-domains', domains: ['a', 'b'], into: 'c' } },
    ]);
    expect(query.mock.calls[0][1]).toEqual({
      edits: [
        { kind: 'split_domain', domain: 'cargo', into: 'hazmat', files: ['a.tsx'] },
        { kind: 'suggest', explanation: 'x', edit: { kind: 'merge_domains', domains: ['a', 'b'], into: 'c' } },
      ],
    });
  });

  it('maps every edit kind to its enum value', () => {
    expect(toEditInput({ kind: 'accept-suggestion', id: 's1' })).toEqual({ kind: 'accept_suggestion', id: 's1' });
    expect(toEditInput({ kind: 'approve' })).toEqual({ kind: 'approve' });
  });

  it('points screenshots at the same origin, so the page needs nothing cross-origin', () => {
    expect(createWorkspaceClient(jest.fn()).screenshotUrl('screens/explore.0.png')).toBe('/api/screenshot?path=screens%2Fexplore.0.png');
  });
});
