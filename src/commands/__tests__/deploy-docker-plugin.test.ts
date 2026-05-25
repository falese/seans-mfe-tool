/**
 * Tests for the plugin-driven Dockerfile generation in deploy (ADR-071, #178).
 *
 * Verifies that dockerComposeProductionDeploy uses loadFrameworkPlugin() for
 * MFE types (shell/remote) and falls back to the static template for api.
 */

import * as fs from 'fs-extra';

jest.mock('fs-extra');
jest.mock('../../framework/loader');
jest.mock('../build/docker', () => ({
  generateDockerfile: jest.fn().mockReturnValue('# plugin-generated dockerfile\n'),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

import { loadFrameworkPlugin } from '../../framework/loader';
import { generateDockerfile } from '../build/docker';
import { dockerComposeProductionDeploy } from '../deploy';

const mockLoadPlugin = loadFrameworkPlugin as jest.Mock;
const mockGenerateDockerfile = generateDockerfile as jest.Mock;

function makeMockPlugin(framework: string) {
  const getDockerStrategy = jest.fn().mockReturnValue({
    builderImage: 'node:20-slim',
    runtimeImage: 'nginx:alpine',
    buildCommands: ['npm ci', 'npm run build'],
    artifactPaths: ['dist/'],
    cmd: ['nginx', '-g', 'daemon off;'],
    needsCliBuilder: framework === 'angular',
  });
  return { id: `${framework}-plugin`, framework, getDockerStrategy };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({ name: 'app', database: 'sqlite' });
  (mockFs.readFile as unknown as jest.Mock).mockResolvedValue('# static template\n');
  (mockFs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
});

describe('dockerComposeProductionDeploy — plugin Dockerfile (ADR-071, #178)', () => {
  it('uses loadFrameworkPlugin for type=shell (default react)', async () => {
    const plugin = makeMockPlugin('react');
    mockLoadPlugin.mockReturnValue(plugin);

    await dockerComposeProductionDeploy({
      name: 'my-shell',
      env: 'production',
      type: 'shell',
      port: 3000,
    });

    expect(mockLoadPlugin).toHaveBeenCalledWith('react');
    expect(plugin.getDockerStrategy).toHaveBeenCalledWith(null);
    expect(mockGenerateDockerfile).toHaveBeenCalled();

    const dockerfileWrite = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find(
      ([p]: [string]) => String(p).endsWith('Dockerfile'),
    );
    expect(dockerfileWrite).toBeDefined();
    expect(dockerfileWrite![1]).toBe('# plugin-generated dockerfile\n');
  });

  it('uses angular plugin when framework=angular and type=remote', async () => {
    const plugin = makeMockPlugin('angular');
    mockLoadPlugin.mockReturnValue(plugin);

    await dockerComposeProductionDeploy({
      name: 'my-remote',
      env: 'production',
      type: 'remote',
      port: 3101,
      framework: 'angular',
    });

    expect(mockLoadPlugin).toHaveBeenCalledWith('angular');
    expect(plugin.getDockerStrategy).toHaveBeenCalled();
  });

  it('reads static template for type=api (no plugin)', async () => {
    await dockerComposeProductionDeploy({
      name: 'my-api',
      env: 'production',
      type: 'api',
      port: 4000,
    });

    expect(mockLoadPlugin).not.toHaveBeenCalled();
    expect(mockGenerateDockerfile).not.toHaveBeenCalled();
    expect(mockFs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('Dockerfile.production.api'),
      'utf8',
    );
  });
});
