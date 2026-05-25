/**
 * build:prod command tests (ADR-071, #175).
 */

import { buildProdCommand } from '../prod';
import { loadFrameworkPlugin } from '../../../framework/loader';
import { ValidationError, BusinessError } from '@seans-mfe/contracts';
import type { BuildResult } from '@seans-mfe/contracts';

jest.mock('../../../framework/loader');
jest.mock('../../../dsl/parser', () => ({
  findManifest: jest.fn().mockResolvedValue(null),
  parseManifestFile: jest.fn(),
}));

const mockLoadPlugin = loadFrameworkPlugin as jest.Mock;

function makeSuccessResult(outputDir: string): BuildResult {
  return {
    success: true,
    artifacts: [outputDir],
    duration_ms: 1234,
    warnings: [],
    errors: [],
  };
}

function makeFailResult(): BuildResult {
  return {
    success: false,
    artifacts: [],
    duration_ms: 500,
    warnings: [],
    errors: [{ message: 'Type error in src/index.tsx', category: 'type' }],
  };
}

function makeMockPlugin(id: string, framework: string, bundler: string, defaultPort: number, result: BuildResult) {
  const buildProduction = jest.fn().mockResolvedValue(result);
  const plugin = { id, displayName: `${framework} test`, framework, bundler, defaultPort, buildProduction };
  return { plugin, buildProduction };
}

describe('buildProdCommand', () => {
  const defaultCwd = process.cwd();
  const defaultOutputDir = 'dist';

  beforeEach(() => jest.clearAllMocks());

  it('runs the react production build with defaults', async () => {
    const outputDir = `${defaultCwd}/${defaultOutputDir}`;
    const { plugin, buildProduction } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001, makeSuccessResult(outputDir));
    mockLoadPlugin.mockReturnValue(plugin);

    const result = await buildProdCommand({ framework: 'react' });

    expect(mockLoadPlugin).toHaveBeenCalledWith('react');
    expect(buildProduction).toHaveBeenCalledWith(null, { cwd: defaultCwd, outputDir });
    expect(result.success).toBe(true);
    expect(result.framework).toBe('react');
    expect(result.bundler).toBe('rspack');
    expect(result.artifacts).toEqual([outputDir]);
    expect(result.duration_ms).toBe(1234);
  });

  it('runs the angular production build with defaults', async () => {
    const outputDir = `${defaultCwd}/${defaultOutputDir}`;
    const { plugin, buildProduction } = makeMockPlugin('angular-webpack', 'angular', 'webpack', 3101, makeSuccessResult(outputDir));
    mockLoadPlugin.mockReturnValue(plugin);

    const result = await buildProdCommand({ framework: 'angular' });

    expect(mockLoadPlugin).toHaveBeenCalledWith('angular');
    expect(buildProduction).toHaveBeenCalledWith(null, { cwd: defaultCwd, outputDir });
    expect(result.framework).toBe('angular');
  });

  it('respects --output-dir override', async () => {
    const { plugin, buildProduction } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001, makeSuccessResult('/custom/out'));
    mockLoadPlugin.mockReturnValue(plugin);

    await buildProdCommand({ framework: 'react', outputDir: '/custom/out' });

    expect(buildProduction).toHaveBeenCalledWith(null, { cwd: defaultCwd, outputDir: '/custom/out' });
  });

  it('respects --cwd override', async () => {
    const { plugin, buildProduction } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001, makeSuccessResult('/project/dist'));
    mockLoadPlugin.mockReturnValue(plugin);

    await buildProdCommand({ framework: 'react', cwd: '/project' });

    expect(buildProduction).toHaveBeenCalledWith(null, { cwd: '/project', outputDir: '/project/dist' });
  });

  it('throws BusinessError when build fails', async () => {
    const { plugin } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001, makeFailResult());
    mockLoadPlugin.mockReturnValue(plugin);

    await expect(buildProdCommand({ framework: 'react' })).rejects.toThrow(BusinessError);
  });

  it('throws ValidationError when framework cannot be determined', async () => {
    await expect(buildProdCommand({})).rejects.toThrow(ValidationError);
  });

  it('includes build errors in the thrown BusinessError context', async () => {
    const { plugin } = makeMockPlugin('react-rspack', 'react', 'rspack', 3001, makeFailResult());
    mockLoadPlugin.mockReturnValue(plugin);

    let caught: unknown;
    try {
      await buildProdCommand({ framework: 'react' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BusinessError);
    const err = caught as BusinessError;
    expect(err.details).toBeDefined();
  });
});
