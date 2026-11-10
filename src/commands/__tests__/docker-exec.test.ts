/**
 * Docker is run with an argument array, never a shell string.
 *
 * `deploy` and `build:docker` used to build `docker …` as a template string
 * for `execSync`, so a name such as `x; touch /tmp/pwned` ran on the host —
 * and both commands are MCP tools, which put that string within reach of any
 * text an agent reads. These tests hold the two properties that close it:
 * nothing reaches a shell, and a value that is not a Docker name is refused
 * before anything is spawned.
 */

import { execFileSync, execSync } from 'child_process';
import { ValidationError } from '@seans-mfe/contracts';
import { runDocker, assertImageName, assertImageRef, assertPort } from '../_docker';
import { deployCommand } from '../deploy';
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

describe('name, reference and port validation', () => {
  it.each(INJECTIONS)('refuses %j as an image name', (value) => {
    expect(() => assertImageName(value, 'name')).toThrow(ValidationError);
  });

  it.each(INJECTIONS)('refuses %j as an image reference', (value) => {
    expect(() => assertImageRef(value, 'tag')).toThrow(ValidationError);
  });

  it.each(['my-app', 'app2', 'meridian.cargo_ops'])('accepts %j as an image name', (value) => {
    expect(() => assertImageName(value, 'name')).not.toThrow();
  });

  it.each(['my-mfe:latest', 'localhost:5000/team/app:1.2.3', 'ghcr.io/org/app'])(
    'accepts %j as an image reference',
    (value) => {
      expect(() => assertImageRef(value, 'tag')).not.toThrow();
    },
  );

  it.each([Number.NaN, 0, -1, 65536, 80.5])('refuses port %p', (value) => {
    expect(() => assertPort(value, 'port')).toThrow(ValidationError);
  });

  it('accepts a port in range', () => {
    expect(() => assertPort(8080, 'port')).not.toThrow();
  });
});

describe('deploy', () => {
  it.each(INJECTIONS)('refuses the name %j before running anything', async (name) => {
    await expect(deployCommand({ name, type: 'remote', env: 'development', port: 8080 })).rejects.toThrow(
      ValidationError,
    );
    expect(mockExecFile).not.toHaveBeenCalled();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('refuses a name under --dry-run too: the plan must be one that could run', async () => {
    await expect(
      deployCommand({ name: 'x; id', type: 'remote', env: 'development', port: 8080, dryRun: true }),
    ).rejects.toThrow(ValidationError);
  });

  it('refuses a port that is not a port', async () => {
    await expect(deployCommand({ name: 'app', type: 'remote', env: 'development', port: Number.NaN })).rejects.toThrow(
      ValidationError,
    );
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('passes every docker argument as its own array element', async () => {
    await deployCommand({ name: 'app', type: 'remote', env: 'development', port: 8080 });
    expect(mockExec).not.toHaveBeenCalled();
    const run = mockExecFile.mock.calls.find(([, args]) => (args as string[])[0] === 'run');
    expect(run?.[0]).toBe('docker');
    expect(run?.[1]).toEqual(expect.arrayContaining(['--name', 'app-dev', '-p', '8080:80', 'app:development']));
  });
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
