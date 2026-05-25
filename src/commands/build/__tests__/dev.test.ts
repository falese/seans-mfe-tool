/**
 * build:dev command tests (ADR-071, #174).
 *
 * Uses pre-aborted AbortSignals so tests don't block waiting for signal events.
 */

import { buildDevCommand } from '../dev';
import { loadFrameworkPlugin } from '../../../framework/loader';
import { ValidationError } from '@seans-mfe/contracts';

jest.mock('../../../framework/loader');
jest.mock('../../../dsl/parser', () => ({
  findManifest: jest.fn().mockResolvedValue(null),
  parseManifestFile: jest.fn(),
}));

const mockLoadPlugin = loadFrameworkPlugin as jest.Mock;

function makeMockPlugin(id: string, framework: string, bundler: string, defaultPort: number) {
  const stopFn = jest.fn().mockResolvedValue(undefined);
  const handle = { url: `http://localhost:${defaultPort}`, stop: stopFn };
  const startDevServer = jest.fn().mockResolvedValue(handle);
  const plugin = { id, displayName: `${framework} test`, framework, bundler, defaultPort, startDevServer };
  return { plugin, startDevServer, stopFn, handle };
}

/** Returns an already-aborted signal so buildDevCommand exits immediately. */
function abortedSignal(): AbortSignal {
  const ctrl = new AbortController();
  ctrl.abort();
  return ctrl.signal;
}

describe('buildDevCommand', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts the react dev server with default port', async () => {
    const { plugin, startDevServer, stopFn } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001);
    mockLoadPlugin.mockReturnValue(plugin);

    const result = await buildDevCommand({ framework: 'react' }, abortedSignal());

    expect(mockLoadPlugin).toHaveBeenCalledWith('react');
    expect(startDevServer).toHaveBeenCalledWith(null, { port: 3001, cwd: process.cwd() });
    expect(stopFn).toHaveBeenCalled();
    expect(result.framework).toBe('react');
    expect(result.bundler).toBe('rspack');
    expect(result.port).toBe(3001);
    expect(result.url).toBe('http://localhost:3001');
  });

  it('starts the angular dev server with default port', async () => {
    const { plugin, startDevServer } = makeMockPlugin('angular-webpack', 'angular', 'webpack', 3101);
    mockLoadPlugin.mockReturnValue(plugin);

    const result = await buildDevCommand({ framework: 'angular' }, abortedSignal());

    expect(mockLoadPlugin).toHaveBeenCalledWith('angular');
    expect(startDevServer).toHaveBeenCalledWith(null, { port: 3101, cwd: process.cwd() });
    expect(result.port).toBe(3101);
  });

  it('respects --port override', async () => {
    const { plugin, startDevServer } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001);
    mockLoadPlugin.mockReturnValue(plugin);

    await buildDevCommand({ framework: 'react', port: 4200 }, abortedSignal());

    expect(startDevServer).toHaveBeenCalledWith(null, { port: 4200, cwd: process.cwd() });
  });

  it('respects --cwd override', async () => {
    const { plugin, startDevServer } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001);
    mockLoadPlugin.mockReturnValue(plugin);

    await buildDevCommand({ framework: 'react', cwd: '/some/project' }, abortedSignal());

    expect(startDevServer).toHaveBeenCalledWith(null, { port: 3001, cwd: '/some/project' });
  });

  it('throws ValidationError when framework cannot be determined', async () => {
    await expect(
      buildDevCommand({}, abortedSignal()),
    ).rejects.toThrow(ValidationError);
  });

  it('calls handle.stop() on shutdown', async () => {
    const { plugin, stopFn } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001);
    mockLoadPlugin.mockReturnValue(plugin);

    await buildDevCommand({ framework: 'react' }, abortedSignal());

    expect(stopFn).toHaveBeenCalledTimes(1);
  });
});
