/**
 * Tests for src/commands/api.ts
 *
 * The command orchestrates OpenAPI spec parsing, template scaffolding,
 * generator invocation, and `npm install`. We mock every external boundary
 * (fs-extra, child_process, swagger-parser, codegen generators) so the unit
 * tests exercise pure orchestration logic.
 *
 * Refs Phase 1.1 of the production-readiness plan.
 */

import * as fs from 'fs-extra';
import { execSync } from 'child_process';
import SwaggerParser from '@apidevtools/swagger-parser';

import { ValidationError, NetworkError, SystemError } from '@seans-mfe/contracts';
import { DatabaseGenerator } from '../../codegen/APIGenerator/DatabaseGenerator';
import { ControllerGenerator } from '../../codegen/APIGenerator/ControllerGenerator';
import * as RouteGenerator from '../../codegen/APIGenerator/RouteGenerator';
import * as securityUtils from '../../utils/securityUtils';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('@apidevtools/swagger-parser');
jest.mock('../../codegen/APIGenerator/DatabaseGenerator');
jest.mock('../../codegen/APIGenerator/ControllerGenerator');
jest.mock('../../codegen/APIGenerator/RouteGenerator');
jest.mock('../../utils/securityUtils');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExec = execSync as jest.MockedFunction<typeof execSync>;
const mockParser = SwaggerParser as jest.Mocked<typeof SwaggerParser>;

// Import after mocks
import ApiCommand, {
  createApiCommand,
  validateDatabaseType,
  ensureMiddleware,
  ensureUtils,
  processTemplates,
  generateDatabaseInit,
  logSuccessInfo,
} from '../api';

function defaultOpenApiSpec() {
  return {
    info: { version: '2.5.0' },
    paths: { '/items': {}, '/items/{id}': {} },
    components: { schemas: { Item: {} } },
  };
}

function arrangeWritableFs(): void {
  // Most fs-extra mocks just need to resolve. Some return JSON for readJson.
  (mockFs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.copy as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.remove as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
  (mockFs.readFile as unknown as jest.Mock).mockResolvedValue('__PROJECT_NAME__:__PORT__:__VERSION__:__DATABASE__');
  (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({
    name: 'placeholder',
    scripts: {},
    dependencies: {},
    devDependencies: {},
  });
}

describe('validateDatabaseType', () => {
  it.each(['mongodb', 'mongo', 'sqlite', 'sql', 'MongoDB', 'SQL'])(
    'accepts %s',
    (db) => {
      expect(validateDatabaseType(db)).toBe(true);
    },
  );

  it('throws a descriptive error for an unsupported database', () => {
    expect(() => validateDatabaseType('cassandra')).toThrow(
      /Unsupported database type: cassandra/,
    );
    expect(() => validateDatabaseType('cassandra')).toThrow(
      /mongodb, mongo, sqlite, sql/,
    );
  });
});

describe('ensureMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeWritableFs();
  });

  it('writes the four canonical middleware files into the supplied directory', async () => {
    await ensureMiddleware('/tmp/mw');

    const writes = (mockFs.writeFile as unknown as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/tmp/mw/auth.js'),
        expect.stringContaining('/tmp/mw/validator.js'),
        expect.stringContaining('/tmp/mw/error-handler.js'),
        expect.stringContaining('/tmp/mw/request-id.js'),
      ]),
    );
    // Each generated file should be a non-empty CommonJS module.
    for (const call of (mockFs.writeFile as unknown as jest.Mock).mock.calls) {
      expect(typeof call[1]).toBe('string');
      expect(String(call[1])).toContain('module.exports');
    }
  });
});

describe('ensureUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeWritableFs();
  });

  it('writes logger, errors, and response utilities', async () => {
    await ensureUtils('/tmp/utils');

    const writes = (mockFs.writeFile as unknown as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/tmp/utils/logger.js'),
        expect.stringContaining('/tmp/utils/errors.js'),
        expect.stringContaining('/tmp/utils/response.js'),
      ]),
    );
  });
});

describe('processTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeWritableFs();
    (securityUtils.generateJWTSecret as jest.Mock).mockReturnValue('deterministic-jwt-secret');
  });

  it('merges database-specific deps for mongodb and writes env files', async () => {
    (mockFs.pathExists as unknown as jest.Mock).mockImplementation(async (p: string) =>
      !p.endsWith('package.json.addon'),
    );
    (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({
      name: 'orig',
      scripts: {},
      dependencies: {},
      devDependencies: {},
    });

    await processTemplates('/proj', {
      name: 'orders',
      version: '0.1.0',
      database: 'mongodb',
      port: 4001,
    });

    // package.json was rewritten with mongoose/mongodb-memory-server deps and
    // mongo-specific db:seed/db:reset scripts.
    const pkgWrite = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('/proj/package.json'),
    );
    expect(pkgWrite).toBeDefined();
    const pkg = JSON.parse(pkgWrite![1] as string);
    expect(pkg.name).toBe('orders');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.dependencies).toHaveProperty('mongoose');
    expect(pkg.dependencies).toHaveProperty('mongodb-memory-server');
    expect(pkg.scripts['db:seed']).toMatch(/seed\.js/);
    expect(pkg.scripts).not.toHaveProperty('db:migrate');

    // .env + .env.example are written and JWT secret is interpolated.
    const envWrite = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('/proj/.env'),
    );
    expect(envWrite).toBeDefined();
    expect(String(envWrite![1])).toContain('JWT_SECRET=deterministic-jwt-secret');
    expect(String(envWrite![1])).toContain('MONGODB_URI=mongodb://localhost:27017/orders');
  });

  it('uses sequelize/sequelize-cli for sqlite and writes a sqlite-flavoured database.js', async () => {
    // Simulate the addon package.json existing so the merge branch is taken.
    (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
    (mockFs.readJson as unknown as jest.Mock).mockImplementation(async (p: string) => {
      if (p.endsWith('package.json.addon')) {
        return {
          scripts: { custom: 'echo custom' },
          dependencies: { 'extra-dep': '1.0.0' },
          devDependencies: { 'extra-dev': '1.0.0' },
        };
      }
      return {
        name: 'orig',
        scripts: { existing: 'echo existing' },
        dependencies: {},
        devDependencies: {},
      };
    });

    await processTemplates('/proj', {
      name: 'inventory',
      version: '0.2.0',
      database: 'sqlite',
      port: 4002,
    });

    expect(mockFs.remove).toHaveBeenCalledWith(expect.stringContaining('package.json.addon'));

    const pkgWrite = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('/proj/package.json'),
    );
    const pkg = JSON.parse(pkgWrite![1] as string);
    expect(pkg.dependencies).toHaveProperty('sequelize');
    expect(pkg.dependencies).toHaveProperty('sqlite3');
    expect(pkg.dependencies).toHaveProperty('extra-dep');
    expect(pkg.devDependencies).toHaveProperty('sequelize-cli');
    expect(pkg.devDependencies).toHaveProperty('extra-dev');
    expect(pkg.scripts['db:migrate']).toBe('sequelize-cli db:migrate');
    expect(pkg.scripts.existing).toBe('echo existing');
    expect(pkg.scripts.custom).toBe('echo custom');

    // database.js must be rewritten with the sqlite dialect marker.
    const dbConfigWrite = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('src/config/database.js'),
    );
    expect(dbConfigWrite).toBeDefined();
    expect(String(dbConfigWrite![1])).toContain("dialect: 'sqlite'");
  });

  it('replaces template placeholders in non-database config files', async () => {
    (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
    (mockFs.readFile as unknown as jest.Mock).mockResolvedValue(
      '/* __PROJECT_NAME__ :: __PORT__ :: __VERSION__ :: __DATABASE__ */',
    );
    (mockFs.readJson as unknown as jest.Mock).mockImplementation(async (p: string) => {
      if (p.endsWith('package.json.addon')) {
        return { scripts: {}, dependencies: {}, devDependencies: {} };
      }
      return { name: 'x', scripts: {}, dependencies: {}, devDependencies: {} };
    });

    await processTemplates('/proj', {
      name: 'billing',
      version: '7.7.7',
      database: 'sqlite',
      port: 5005,
    });

    // src/config.js (non-database file) should have all placeholders substituted.
    const configWrite = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('src/config.js'),
    );
    expect(configWrite).toBeDefined();
    expect(String(configWrite![1])).toContain('billing :: 5005 :: 7.7.7 :: sqlite');
  });

  it('wraps internal failures with a "Failed to process templates" message', async () => {
    (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(false);
    (mockFs.readJson as unknown as jest.Mock).mockRejectedValue(new Error('disk full'));

    await expect(
      processTemplates('/proj', {
        name: 'x',
        version: '0.0.1',
        database: 'sqlite',
        port: 3001,
      }),
    ).rejects.toThrow(/Failed to process templates: .*Failed to process package\.json.*disk full/);
  });
});

describe('generateDatabaseInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeWritableFs();
  });

  it('writes a mongoose-flavoured init script for mongo databases', async () => {
    await generateDatabaseInit('/proj', 'mongo');

    const call = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('init.js'),
    );
    expect(call).toBeDefined();
    expect(String(call![1])).toContain("require('mongoose')");
    expect(String(call![1])).toContain('mongoose.connect');
  });

  it('writes a sequelize-flavoured init script for sql/sqlite databases', async () => {
    await generateDatabaseInit('/proj', 'sqlite');

    const call = (mockFs.writeFile as unknown as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('init.js'),
    );
    expect(call).toBeDefined();
    expect(String(call![1])).toContain('sequelize.authenticate');
  });
});

describe('logSuccessInfo', () => {
  it('logs mongo-specific next steps for mongo databases', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    try {
      logSuccessInfo(
        'orders',
        'mongodb',
        defaultOpenApiSpec(),
        { spec: 'spec.yaml', port: 4100 },
      );
      const printed = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(printed).toMatch(/Database: mongodb/);
      expect(printed).toMatch(/Routes: 2/);
      expect(printed).toMatch(/Models: 1/);
      expect(printed).toMatch(/Port: 4100/);
      expect(printed).toMatch(/db:seed/);
      expect(printed).toMatch(/MongoDB connection/);
      expect(printed).not.toMatch(/db:migrate/);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('logs sql-specific next steps and defaults port when missing', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    try {
      logSuccessInfo('orders', 'sqlite', defaultOpenApiSpec(), {
        spec: 'spec.yaml',
      });
      const printed = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(printed).toMatch(/Port: 3001/); // default
      expect(printed).toMatch(/db:migrate/);
      expect(printed).toMatch(/api-docs/);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('createApiCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeWritableFs();
    (securityUtils.generateJWTSecret as jest.Mock).mockReturnValue('secret');
    (mockParser.parse as unknown as jest.Mock).mockResolvedValue(defaultOpenApiSpec());
    (mockParser.dereference as unknown as jest.Mock).mockResolvedValue(defaultOpenApiSpec());
    (DatabaseGenerator.generate as jest.Mock).mockResolvedValue(undefined);
    (ControllerGenerator.generate as jest.Mock).mockResolvedValue(undefined);
    (RouteGenerator.generateRoutes as jest.Mock).mockResolvedValue(undefined);
    mockExec.mockReturnValue(Buffer.from(''));
  });

  it('rejects a name that would traverse outside the working directory', async () => {
    await expect(
      createApiCommand('../../../tmp/evil', { spec: 'spec.yaml', database: 'sqlite', port: 3001 }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Nothing should have been generated for a rejected name.
    expect(mockParser.parse).not.toHaveBeenCalled();
    expect(DatabaseGenerator.generate).not.toHaveBeenCalled();
  });

  it('returns dry-run metadata without writing files or running npm install', async () => {
    const result = await createApiCommand('my-api', {
      spec: 'spec.yaml',
      database: 'sqlite',
      port: 3001,
      dryRun: true,
    });

    expect(result).toMatchObject({
      name: 'my-api',
      database: 'sqlite',
      port: 3001,
      dryRun: true,
    });
    expect(Array.isArray(result.plannedChanges)).toBe(true);
    expect(result.plannedChanges!.length).toBeGreaterThan(0);
    expect(mockExec).not.toHaveBeenCalled();
    expect(mockParser.parse).not.toHaveBeenCalled();
    expect(DatabaseGenerator.generate).not.toHaveBeenCalled();
  });

  it('runs the full happy-path: parse → copy templates → generate → install', async () => {
    const result = await createApiCommand('catalog', {
      spec: 'spec.yaml',
      database: 'mongodb',
      port: 4200,
    });

    expect(mockParser.parse).toHaveBeenCalled();
    expect(mockParser.dereference).toHaveBeenCalled();
    expect(DatabaseGenerator.generate).toHaveBeenCalledWith('mongodb', expect.any(String), expect.any(Object));
    expect(ControllerGenerator.generate).toHaveBeenCalledWith('mongodb', expect.any(String), expect.any(Object));
    expect(RouteGenerator.generateRoutes).toHaveBeenCalled();
    expect(mockExec).toHaveBeenCalledWith(
      'npm install',
      expect.objectContaining({ cwd: expect.any(String), stdio: 'inherit' }),
    );
    expect(result.name).toBe('catalog');
    expect(result.database).toBe('mongodb');
    expect(result.port).toBe(4200);
    expect(result.dryRun).toBe(false);
  });

  it('defaults to sqlite + port 3001 when neither flag is supplied', async () => {
    const result = await createApiCommand('default-api', { spec: 'spec.yaml' });

    expect(result.database).toBe('sqlite');
    expect(result.port).toBe(3001);
    expect(DatabaseGenerator.generate).toHaveBeenCalledWith('sqlite', expect.any(String), expect.any(Object));
  });

  it('rejects an invalid port via ValidationError', async () => {
    await expect(
      createApiCommand('bad-port', { spec: 'spec.yaml', database: 'sqlite', port: 99999 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects unsupported database types', async () => {
    await expect(
      createApiCommand('bad-db', { spec: 'spec.yaml', database: 'cassandra' }),
    ).rejects.toThrow(/Unsupported database type/);
  });

  it('wraps remote OpenAPI fetch failures in NetworkError', async () => {
    (mockParser.parse as unknown as jest.Mock).mockRejectedValueOnce(new Error('DNS failure'));

    await expect(
      createApiCommand('remote-api', {
        spec: 'https://example.com/spec.yaml',
        database: 'sqlite',
      }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('wraps local OpenAPI parse failures in SystemError', async () => {
    (mockParser.parse as unknown as jest.Mock).mockRejectedValueOnce(new Error('bad yaml'));

    await expect(
      createApiCommand('bad-local', { spec: './spec.yaml', database: 'sqlite' }),
    ).rejects.toBeInstanceOf(SystemError);
  });

  it('propagates generator failures with a descriptive message', async () => {
    (DatabaseGenerator.generate as jest.Mock).mockRejectedValueOnce(
      new Error('schema generation exploded'),
    );

    await expect(
      createApiCommand('boom', { spec: 'spec.yaml', database: 'sqlite' }),
    ).rejects.toThrow('schema generation exploded');
  });

  it('prints the stack trace when DEBUG is set on a failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const origDebug = process.env.DEBUG;
    process.env.DEBUG = '1';

    (DatabaseGenerator.generate as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('boom'), { stack: 'Error: boom\n  at test' }),
    );

    try {
      await expect(
        createApiCommand('dbg', { spec: 'spec.yaml', database: 'sqlite' }),
      ).rejects.toThrow('boom');
      const printed = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(printed).toMatch(/Stack trace/);
    } finally {
      errorSpy.mockRestore();
      if (origDebug === undefined) delete process.env.DEBUG;
      else process.env.DEBUG = origDebug;
    }
  });

  it('does NOT copy a db-specific template when its directory is absent', async () => {
    (mockFs.pathExists as unknown as jest.Mock).mockImplementation(async (p: string) => {
      // The db-specific template dir is missing; everything else exists.
      if (String(p).endsWith('codegen/templates/api/sqlite')) return false;
      return true;
    });

    await createApiCommand('skinny', { spec: 'spec.yaml', database: 'sqlite' });

    const copyCalls = (mockFs.copy as unknown as jest.Mock).mock.calls.map((c) => c[0] as string);
    // The base template is always copied. The sqlite overlay is NOT.
    expect(copyCalls.some((p) => p.endsWith('templates/api/base'))).toBe(true);
    expect(copyCalls.every((p) => !p.endsWith('templates/api/sqlite'))).toBe(true);
  });
});

describe('Api oclif command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeWritableFs();
    (securityUtils.generateJWTSecret as jest.Mock).mockReturnValue('secret');
    (mockParser.parse as unknown as jest.Mock).mockResolvedValue(defaultOpenApiSpec());
    (mockParser.dereference as unknown as jest.Mock).mockResolvedValue(defaultOpenApiSpec());
    (DatabaseGenerator.generate as jest.Mock).mockResolvedValue(undefined);
    (ControllerGenerator.generate as jest.Mock).mockResolvedValue(undefined);
    (RouteGenerator.generateRoutes as jest.Mock).mockResolvedValue(undefined);
    mockExec.mockReturnValue(Buffer.from(''));
  });

  it('declares the expected oclif metadata (description, args, baseFlags)', () => {
    expect(ApiCommand.description).toMatch(/api/i);
    expect(ApiCommand.args.name).toBeDefined();
    expect(ApiCommand.args.name.required).toBe(true);
    expect((ApiCommand.flags as Record<string, unknown>).json).toBeDefined();
    expect((ApiCommand.flags as Record<string, unknown>).spec).toBeDefined();
    expect((ApiCommand.flags as Record<string, unknown>).database).toBeDefined();
    expect((ApiCommand.flags as Record<string, unknown>)['dry-run']).toBeDefined();
  });

  it('runCommand forwards parsed args and flags to createApiCommand (dry-run)', async () => {
    // Bypass the oclif Command constructor; stub this.parse() to return
    // already-parsed args + flags so we exercise the runCommand body without
    // running the full Config.load() machinery.
    const cmd = Object.create(ApiCommand.prototype) as InstanceType<typeof ApiCommand>;
    (cmd as unknown as { parse: jest.Mock }).parse = jest.fn().mockResolvedValue({
      args: { name: 'oclif-api' },
      flags: { spec: 'spec.yaml', database: 'sqlite', port: '3001', 'dry-run': true },
    });

    const result = await (cmd as unknown as { runCommand(): Promise<{
      name: string; dryRun: boolean;
    }> }).runCommand();

    expect(result.name).toBe('oclif-api');
    expect(result.dryRun).toBe(true);
    // dry-run must NOT have invoked the heavyweight pipeline
    expect(mockParser.parse).not.toHaveBeenCalled();
  });
});
