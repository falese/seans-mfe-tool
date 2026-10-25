import type { WorkspaceClient } from '../client';
import { fixtureStatus } from './fixture';

/** A client that answers from the fixture and records what it was asked to apply. */
export function fakeClient(over: Partial<WorkspaceClient> = {}): WorkspaceClient & { applied: unknown[] } {
  const applied: unknown[] = [];
  return {
    applied,
    read: jest.fn().mockResolvedValue(fixtureStatus()),
    apply: jest.fn().mockImplementation(async (edits) => {
      applied.push(edits);
      return fixtureStatus({ approval: { status: 'current', by: 'sean', at: 'now' } });
    }),
    screenshotUrl: (p: string) => `/api/screenshot?path=${p}`,
    agent: jest.fn().mockResolvedValue({ connected: false, reason: 'No agent is connected: set ANTHROPIC_API_KEY before starting the workspace.' }),
    ask: jest.fn().mockRejectedValue(new Error('no agent')),
    ...over,
  };
}
