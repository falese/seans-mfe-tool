/**
 * Docker is run with an argument array, never a shell string.
 *
 * `build:docker` used to build `docker …` as a template string for `execSync`
 * (as did `deploy`, since removed — ADR-122), so a tag such as
 * `x; touch /tmp/pwned` ran on the host — and the command is an MCP tool, which put that string within reach of any
 * text an agent reads. These tests hold the two properties that close it:
 * nothing reaches a shell, and a value that is not a Docker name is refused
 * before anything is spawned.
 */

import { execFileSync, execSync } from 'child_process';
import { ValidationError } from '@seans-mfe/contracts';
import { runDocker, assertImageRef } from '../_docker';
import { buildDockerCommand } from '../build/docker';
import { loadFrameworkPlugin } from '../../framework/loader';

jest.mock('child_process', () => ({
  execFileSync: jest.fn(() => 'running'),
  execSync: jest.fn(),
}));
jest.mock('../../framework/loader');
jest.mock('@seans-mfe/dsl', () => ({
  findManifest: jest.fn().mockResolvedValue(null),
  parseManifestFile: jest.fn(),
}));
jest.mock('fs-extra', () => ({
  outputFile: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(true),
  existsSync: jest.fn().mockReturnValue(true),
  ensureDir: jest.fn().mockResolvedValue(undefined),
  copy: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));

const mockExecFile = execFileSync as unknown as jest.Mock;
const mockExec = execSync as unknown as jest.Mock;

const INJECTIONS = ['x; touch /tmp/pwned', 'x$(id)', 'x`id`', 'x && id', '-rm', 'x y', 'x|id', ''];

beforeEach(() => {
  mockExecFile.mockClear();
  mockExec.mockClear();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('runDocker', () => {
  it('runs docker with an argument array and no shell', () => {
    runDocker(['build', '-t', 'app:dev', '/tmp/ctx'], { stdio: 'ignore' });
    expect(mockExecFile).toHaveBeenCalledWith('docker', ['build', '-t', 'app:dev', '/tmp/ctx'], { stdio: 'ignore' });
    expect(mockExec).not.toHaveBeenCalled();
  });
});

describe('image reference validation', () => {
  it.each(INJECTIONS)('refuses %j as an image reference', (value) => {
    expect(() => assertImageRef(value, 'tag')).toThrow(ValidationError);
  });

  it.each(['my-mfe:latest', 'localhost:5000/team/app:1.2.3', 'ghcr.io/org/app'])(
    'accepts %j as an image reference',
    (value) => {
      expect(() => assertImageRef(value, 'tag')).not.toThrow();
    },
  );
});

describe('build:docker', () => {
  beforeEach(() => {
    (loadFrameworkPlugin as jest.Mock).mockReturnValue({
      id: 'react-rspack',
      framework: 'react',
      bundler: 'rspack',
      displayName: 'React',
      servesHttp: true,
      getDockerStrategy: () => ({
        builderImage: 'node:20-slim',
        runtimeImage: 'nginx:alpine',
        buildCommands: [],
        artifactPaths: ['dist'],
        cmd: ['nginx'],
      }),
    });
  });

  it.each(INJECTIONS.filter((v) => v !== ''))('refuses the tag %j before running anything', async (tag) => {
    await expect(buildDockerCommand({ framework: 'react', build: true, tag, cwd: '/tmp/app' })).rejects.toThrow(
      ValidationError,
    );
    expect(mockExecFile).not.toHaveBeenCalled();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('passes the tag and a directory with spaces as separate arguments', async () => {
    await buildDockerCommand({ framework: 'react', build: true, tag: 'my-mfe:latest', cwd: '/tmp/my app; id' });
    expect(mockExecFile).toHaveBeenCalledWith('docker', ['build', '-t', 'my-mfe:latest', '/tmp/my app; id'], {
      stdio: 'inherit',
    });
    expect(mockExec).not.toHaveBeenCalled();
  });
});
