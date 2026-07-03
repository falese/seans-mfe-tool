/**
 * build:docker command tests (ADR-036, #177).
 */

import { buildDockerCommand, generateDockerfile } from '../docker';
import { loadFrameworkPlugin } from '../../../framework/loader';
import { ValidationError } from '@seans-mfe/contracts';
import type { DockerStrategy } from '@seans-mfe/contracts';

jest.mock('../../../framework/loader');
jest.mock('@seans-mfe/dsl', () => ({
  findManifest: jest.fn().mockResolvedValue(null),
  parseManifestFile: jest.fn(),
}));
jest.mock('fs-extra', () => ({
  outputFile: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(false),
}));
jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

const mockLoadPlugin = loadFrameworkPlugin as jest.Mock;

const reactStrategy: DockerStrategy = {
  builderImage: 'node:20-slim',
  runtimeImage: 'nginx:alpine',
  buildCommands: ['npm ci', 'npm run build'],
  artifactPaths: ['dist/'],
  cmd: ['nginx', '-g', 'daemon off;'],
  needsCliBuilder: true,
  healthcheck: 'wget -qO- http://127.0.0.1:80/ || exit 1',
};

const angularStrategy: DockerStrategy = {
  ...reactStrategy,
  needsCliBuilder: true,
};

function makeMockPlugin(id: string, framework: string, bundler: string, strategy: DockerStrategy) {
  const getDockerStrategy = jest.fn().mockReturnValue(strategy);
  const plugin = { id, displayName: `${framework} test`, framework, bundler, defaultPort: 3001, getDockerStrategy };
  return { plugin, getDockerStrategy };
}

describe('generateDockerfile', () => {
  it('emits cli-builder + builder + runtime stages for react', () => {
    const df = generateDockerfile(reactStrategy, 'my-mfe');
    expect(df).toContain('FROM seans-mfe-tool-cli:latest AS cli-builder');
    expect(df).toContain('FROM node:20-slim AS builder');
    expect(df).toContain('FROM nginx:alpine');
    expect(df).toContain('RUN npm ci');
    expect(df).toContain('RUN npm run build');
    expect(df).toContain('COPY --from=builder /app/dist/');
    expect(df).toContain('CMD ["nginx", "-g", "daemon off;"]');
  });

  it('emits cli-builder stage when needsCliBuilder is true', () => {
    const df = generateDockerfile(angularStrategy, 'ng-mfe');
    expect(df).toContain('FROM seans-mfe-tool-cli:latest AS cli-builder');
    expect(df).toContain('COPY --from=cli-builder');
    expect(df).toContain('FROM node:20-slim AS builder');
  });

  it('emits HEALTHCHECK when strategy has one', () => {
    const df = generateDockerfile(reactStrategy, 'my-mfe');
    expect(df).toContain('HEALTHCHECK');
    expect(df).toContain('wget -qO- http://127.0.0.1:80/ || exit 1');
  });

  it('omits HEALTHCHECK when strategy has none', () => {
    const { healthcheck: _, ...noHealth } = reactStrategy;
    const df = generateDockerfile(noHealth as DockerStrategy, 'my-mfe');
    expect(df).not.toContain('HEALTHCHECK');
  });

  it('handles multiple artifact paths', () => {
    const multi = { ...reactStrategy, artifactPaths: ['dist/', 'public/'] };
    const df = generateDockerfile(multi, 'my-mfe');
    expect(df).toContain('COPY --from=builder /app/dist/');
    expect(df).toContain('COPY --from=builder /app/public/');
  });

  it('copies config files from the cli-builder image', () => {
    const strategy: DockerStrategy = {
      ...reactStrategy,
      configFiles: [
        {
          from: 'cli-builder',
          src: '/seans-mfe-tool/dist/codegen/templates/docker/nginx.mfe.conf',
          dest: '/etc/nginx/conf.d/default.conf',
        },
      ],
    };
    const df = generateDockerfile(strategy, 'my-mfe');
    expect(df).toContain(
      'COPY --from=cli-builder /seans-mfe-tool/dist/codegen/templates/docker/nginx.mfe.conf /etc/nginx/conf.d/default.conf',
    );
  });

  it('copies config files from the build context', () => {
    const strategy: DockerStrategy = {
      ...reactStrategy,
      configFiles: [{ from: 'context', src: 'nginx.conf', dest: '/etc/nginx/conf.d/default.conf' }],
    };
    const df = generateDockerfile(strategy, 'my-mfe');
    expect(df).toContain('COPY nginx.conf /etc/nginx/conf.d/default.conf');
  });

  it('emits runtime setup RUN commands, USER, and EXPOSE', () => {
    const strategy: DockerStrategy = {
      ...reactStrategy,
      runtimeSetup: ['chown -R nginx:nginx /usr/share/nginx/html'],
      user: 'nginx',
      expose: 8080,
    };
    const df = generateDockerfile(strategy, 'my-mfe');
    expect(df).toContain('RUN chown -R nginx:nginx /usr/share/nginx/html');
    expect(df).toContain('EXPOSE 8080');
    expect(df).toContain('USER nginx');
    // USER must come after setup and before CMD.
    expect(df.indexOf('USER nginx')).toBeLessThan(df.indexOf('CMD ['));
    expect(df.indexOf('RUN chown')).toBeLessThan(df.indexOf('USER nginx'));
  });
});

describe('buildDockerCommand', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls getDockerStrategy and writes the Dockerfile', async () => {
    const { plugin, getDockerStrategy } = makeMockPlugin('react-rspack', 'react', 'rspack', reactStrategy);
    mockLoadPlugin.mockReturnValue(plugin);
    const fsExtra = require('fs-extra');

    const result = await buildDockerCommand({ framework: 'react' });

    expect(mockLoadPlugin).toHaveBeenCalledWith('react');
    expect(getDockerStrategy).toHaveBeenCalledWith(null);
    expect(fsExtra.outputFile).toHaveBeenCalled();
    expect(result.framework).toBe('react');
    expect(result.built).toBe(false);
  });

  it('runs docker build when --build is passed', async () => {
    const { plugin } = makeMockPlugin('react-rspack', 'react', 'rspack', reactStrategy);
    mockLoadPlugin.mockReturnValue(plugin);
    const { execFileSync } = require('child_process');

    const result = await buildDockerCommand({ framework: 'react', build: true, tag: 'my-mfe:latest' });

    expect(execFileSync).toHaveBeenCalledWith(
      'docker',
      ['build', '-t', 'my-mfe:latest', expect.any(String)],
      expect.any(Object),
    );
    expect(result.built).toBe(true);
    expect(result.imageTag).toBe('my-mfe:latest');
  });

  it('throws ValidationError when framework cannot be determined', async () => {
    await expect(buildDockerCommand({})).rejects.toThrow(ValidationError);
  });

  it('uses custom --output path', async () => {
    const { plugin } = makeMockPlugin('react-rspack', 'react', 'rspack', reactStrategy);
    mockLoadPlugin.mockReturnValue(plugin);
    const fsExtra = require('fs-extra');

    await buildDockerCommand({ framework: 'react', output: '/custom/Dockerfile' });

    expect(fsExtra.outputFile).toHaveBeenCalledWith('/custom/Dockerfile', expect.any(String));
    const [, result] = (await buildDockerCommand({ framework: 'react', output: '/custom/Dockerfile' }), []);
    expect(fsExtra.outputFile.mock.calls[0][0]).toBe('/custom/Dockerfile');
  });
});
