/**
 * Tests for src/commands/schemas.ts
 *
 * Covers schemasCommand() and the resolveSchemaDir() fallback chain.
 * Refs Phase 1.1 of the production-readiness plan.
 */

import * as fs from 'fs-extra';

jest.mock('fs-extra');

const mockFs = fs as jest.Mocked<typeof fs>;

// Import after mocks
import SchemasCommand, { schemasCommand } from '../schemas';

describe('schemasCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: dev schemas/ dir is present, dist/ is not (matches local dev tree)
    (mockFs.existsSync as unknown as jest.Mock).mockImplementation((p: unknown) => {
      return typeof p === 'string' && p.endsWith('/schemas');
    });
  });

  it('returns a catalog assembled from sorted schema files', async () => {
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue([
      'bff.json',
      'api.json',
      'README.md', // non-JSON, must be filtered
    ]);
    (mockFs.readJson as unknown as jest.Mock).mockImplementation(async (p: string) => {
      if (p.endsWith('api.json')) {
        return {
          title: 'api',
          description: 'Create an API',
          input: { type: 'object' },
          output: { type: 'object' },
          errorCodes: [64, 69],
        };
      }
      if (p.endsWith('bff.json')) {
        return {
          title: 'bff:init',
          description: 'Initialize BFF',
          input: { type: 'object' },
          output: { type: 'object' },
          errorCodes: [64],
        };
      }
      // CLI package.json read
      return { version: '1.2.3' };
    });

    const catalog = await schemasCommand();

    expect(catalog.cliVersion).toBe('1.2.3');
    expect(catalog.commands.map((c) => c.name)).toEqual(['api', 'bff:init']);
    expect(catalog.commands[0]).toMatchObject({
      name: 'api',
      description: 'Create an API',
      errorCodes: [64, 69],
    });
    expect(catalog.commands[1].errorCodes).toEqual([64]);
  });

  it('defaults missing fields and derives a name from filename when title is absent', async () => {
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue(['untitled.json']);
    (mockFs.readJson as unknown as jest.Mock).mockImplementation(async (p: string) => {
      if (p.endsWith('untitled.json')) {
        // Schema with no title / description / errorCodes / input / output
        return {};
      }
      return { version: '9.9.9' };
    });

    const catalog = await schemasCommand();

    expect(catalog.commands).toHaveLength(1);
    expect(catalog.commands[0]).toEqual({
      name: 'untitled',
      description: undefined,
      input: {},
      output: {},
      errorCodes: [],
    });
  });

  it('falls back to cliVersion "0.0.0" when package.json read fails', async () => {
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    (mockFs.readJson as unknown as jest.Mock).mockRejectedValue(
      new Error('ENOENT: no such file or directory'),
    );

    const catalog = await schemasCommand();

    expect(catalog.cliVersion).toBe('0.0.0');
    expect(catalog.commands).toEqual([]);
  });

  it('throws a clear error when neither dist/schemas nor schemas/ exists', async () => {
    (mockFs.existsSync as unknown as jest.Mock).mockReturnValue(false);

    await expect(schemasCommand()).rejects.toThrow(/schemas\/ directory not found/);
    await expect(schemasCommand()).rejects.toThrow(/npm run build:schemas/);
  });

  it('reads from the primary (sibling) schemas dir when both candidates exist', async () => {
    // Both candidates exist — resolveSchemaDir() must return the FIRST hit
    // (the sibling dir, one level above __dirname, used by the published
    // dist/ build). It must NOT fall through to the dev fallback two levels up.
    (mockFs.existsSync as unknown as jest.Mock).mockReturnValue(true);

    const readDirCalls: string[] = [];
    (mockFs.readdir as unknown as jest.Mock).mockImplementation(async (p: string) => {
      readDirCalls.push(p);
      return [];
    });
    (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({ version: '2.0.0' });

    const catalog = await schemasCommand();

    expect(catalog.cliVersion).toBe('2.0.0');
    expect(readDirCalls).toHaveLength(1);
    // Sibling dir is one level above __dirname; dev fallback is two levels above.
    // The primary path must not climb past one parent.
    expect(readDirCalls[0]).not.toContain('/../..');
    expect(readDirCalls[0]).toMatch(/schemas$/);
  });

  it('filters out non-JSON files even when present in schemas/', async () => {
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue([
      'a.json',
      '.DS_Store',
      'README.md',
      'b.json.bak',
    ]);
    (mockFs.readJson as unknown as jest.Mock).mockImplementation(async (p: string) => {
      if (p.endsWith('a.json')) return { title: 'a' };
      return { version: '0.1.0' };
    });

    const catalog = await schemasCommand();

    expect(catalog.commands.map((c) => c.name)).toEqual(['a']);
  });

  it('falls back to the dev schemas/ dir when the published sibling dir is missing', async () => {
    // resolveSchemaDir() tries the sibling (one-up) first, then the dev
    // (two-up) fallback. Simulate the published path missing but the dev
    // path present so the second branch is exercised.
    let call = 0;
    (mockFs.existsSync as unknown as jest.Mock).mockImplementation(() => {
      call += 1;
      return call !== 1; // first call (sibling) -> false, second (dev) -> true
    });
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({ version: '5.0.0' });

    const catalog = await schemasCommand();

    expect(catalog.cliVersion).toBe('5.0.0');
    expect(catalog.commands).toEqual([]);
  });

  it('falls back to "0.0.0" when package.json has no version field', async () => {
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    // package.json read succeeds but has no `version` -> the `?? cliVersion` branch fires.
    (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({ name: 'unversioned' });

    const catalog = await schemasCommand();

    expect(catalog.cliVersion).toBe('0.0.0');
  });
});

describe('Schemas oclif command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockFs.existsSync as unknown as jest.Mock).mockImplementation((p: unknown) => {
      return typeof p === 'string' && p.endsWith('/schemas');
    });
  });

  it('declares oclif metadata (description, examples, baseFlags)', () => {
    expect(SchemasCommand.description).toMatch(/schemas/i);
    expect(Array.isArray(SchemasCommand.examples)).toBe(true);
    expect(SchemasCommand.examples.length).toBeGreaterThan(0);
    // BaseCommand.baseFlags must be inherited so --json is recognised
    expect((SchemasCommand.flags as { json?: unknown }).json).toBeDefined();
  });

  it('runCommand emits the catalog to stdout in human (no --json) mode', async () => {
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue(['x.json']);
    (mockFs.readJson as unknown as jest.Mock).mockImplementation(async (p: string) => {
      if (p.endsWith('x.json')) return { title: 'x' };
      return { version: '3.0.0' };
    });

    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      // Bypass the oclif Command constructor — we only need argv + runCommand.
      const cmd = Object.create(SchemasCommand.prototype) as InstanceType<typeof SchemasCommand>;
      (cmd as unknown as { argv: string[] }).argv = []; // no --json
      const result = await (cmd as unknown as { runCommand(): Promise<unknown> }).runCommand();

      expect(result).toMatchObject({ cliVersion: '3.0.0' });
      expect(writeSpy).toHaveBeenCalled();
      const written = writeSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(written).toContain('"cliVersion": "3.0.0"');
      expect(written).toContain('"name": "x"');
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('runCommand does NOT write to stdout when --json is passed (BaseCommand owns emission)', async () => {
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({ version: '4.0.0' });

    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const cmd = Object.create(SchemasCommand.prototype) as InstanceType<typeof SchemasCommand>;
      (cmd as unknown as { argv: string[] }).argv = ['--json'];
      const result = await (cmd as unknown as { runCommand(): Promise<unknown> }).runCommand();

      expect(result).toMatchObject({ cliVersion: '4.0.0' });
      expect(writeSpy).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
    }
  });
});
