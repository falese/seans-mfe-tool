/**
 * Phase 1.2 integration test — codegen workflow.
 *
 * Exercises the API-codegen pipeline end-to-end against a real temp dir:
 *
 *   write OpenAPI spec  →  api  →  controllers + database + routes generated
 *
 * The only external side effect we suppress is the final `npm install` step
 * (mocked via child_process.execSync) — every other layer (SwaggerParser,
 * DatabaseGenerator, ControllerGenerator, RouteGenerator, templateProcessor)
 * runs against the real filesystem. Templates live at
 * src/codegen/templates/api which the api command resolves through
 * __dirname-relative paths.
 */

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

import { createApiCommand } from '../../commands/api';

const execSyncMock = execSync as jest.MockedFunction<typeof execSync>;

const PETSTORE_YAML = `openapi: 3.0.0
info:
  title: Petstore
  version: 1.2.3
paths:
  /pets:
    get:
      operationId: listPets
      summary: List pets
      responses:
        '200':
          description: A list of pets
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Pet'
    post:
      operationId: createPet
      summary: Create a pet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Pet'
      responses:
        '201':
          description: Created
  /pets/{petId}:
    get:
      operationId: getPet
      summary: Get a pet
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: A pet
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pet'
components:
  schemas:
    Pet:
      type: object
      required:
        - name
      properties:
        id:
          type: string
        name:
          type: string
        tag:
          type: string
`;

async function writeSpec(specPath: string, body = PETSTORE_YAML): Promise<void> {
  await fs.writeFile(specPath, body, 'utf8');
}

describe('integration: codegen workflow', () => {
  let workspace: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  beforeEach(async () => {
    workspace = path.join(
      os.tmpdir(),
      `mfe-codegen-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.ensureDir(workspace);
    process.chdir(workspace);
    execSyncMock.mockReset();
    execSyncMock.mockReturnValue(Buffer.from(''));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (workspace && (await fs.pathExists(workspace))) {
      await fs.remove(workspace);
    }
  });

  describe('api command — sqlite database', () => {
    it('scaffolds the full API project layout from a real OpenAPI spec', async () => {
      const specPath = path.join(workspace, 'petstore.yaml');
      await writeSpec(specPath);

      const result = await createApiCommand('petstore_sqlite', {
        spec: 'petstore.yaml',
        database: 'sqlite',
        port: '4001',
      });

      const projectDir = path.join(workspace, 'petstore_sqlite');

      // Result envelope
      expect(result.name).toBe('petstore_sqlite');
      expect(result.database).toBe('sqlite');
      expect(result.port).toBe(4001);
      expect(result.dryRun).toBe(false);

      // npm install was attempted exactly once and against the new project.
      expect(execSyncMock).toHaveBeenCalledTimes(1);
      const [cmd, opts] = execSyncMock.mock.calls[0];
      expect(cmd).toBe('npm install');
      expect((opts as { cwd?: string })?.cwd).toBe(projectDir);

      // The base + sqlite template trees were copied into the project.
      expect(await fs.pathExists(path.join(projectDir, 'src'))).toBe(true);
      expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);

      // Generator-emitted directories must all exist.
      for (const dir of [
        'src/routes',
        'src/controllers',
        'src/models',
        'src/middleware',
        'src/utils',
        'src/database',
        'src/config',
      ]) {
        expect(await fs.pathExists(path.join(projectDir, dir))).toBe(true);
      }
    });

    it('wires sequelize/sqlite into package.json and emits a sqlite db config', async () => {
      const specPath = path.join(workspace, 'petstore.yaml');
      await writeSpec(specPath);

      await createApiCommand('petstore_sqlite_deps', {
        spec: 'petstore.yaml',
        database: 'sqlite',
        port: '4002',
      });

      const projectDir = path.join(workspace, 'petstore_sqlite_deps');

      const pkg = (await fs.readJson(path.join(projectDir, 'package.json'))) as {
        name: string;
        dependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };

      expect(pkg.name).toBe('petstore_sqlite_deps');
      expect(pkg.dependencies).toMatchObject({
        sequelize: expect.any(String),
        sqlite3: expect.any(String),
        express: expect.any(String),
      });
      // Should NOT have pulled in the mongo deps for a sqlite project.
      expect(pkg.dependencies?.mongoose).toBeUndefined();
      expect(pkg.scripts).toMatchObject({
        'db:migrate': expect.stringMatching(/sequelize/),
      });

      const dbConfig = await fs.readFile(
        path.join(projectDir, 'src', 'config', 'database.js'),
        'utf8',
      );
      expect(dbConfig).toContain('sqlite');
    });

    it('renders a sqlite-shaped database init script', async () => {
      const specPath = path.join(workspace, 'petstore.yaml');
      await writeSpec(specPath);

      await createApiCommand('petstore_sqlite_init', {
        spec: 'petstore.yaml',
        database: 'sqlite',
        port: '4003',
      });

      const initJs = await fs.readFile(
        path.join(workspace, 'petstore_sqlite_init', 'src', 'database', 'init.js'),
        'utf8',
      );
      expect(initJs).toContain('sequelize');
      expect(initJs).not.toContain('mongoose');
    });

    it('produces a controller file for each resource in the spec', async () => {
      const specPath = path.join(workspace, 'petstore.yaml');
      await writeSpec(specPath);

      await createApiCommand('petstore_controllers', {
        spec: 'petstore.yaml',
        database: 'sqlite',
        port: '4004',
      });

      const controllersDir = path.join(workspace, 'petstore_controllers', 'src', 'controllers');
      const controllerFiles = await fs.readdir(controllersDir);
      // /pets and /pets/{petId} share the `pets` resource → one controller.
      expect(controllerFiles).toEqual(expect.arrayContaining([expect.stringMatching(/pet/i)]));
      expect(controllerFiles.length).toBeGreaterThan(0);
    });

    it('emits .env + .env.example with a freshly generated JWT secret', async () => {
      const specPath = path.join(workspace, 'petstore.yaml');
      await writeSpec(specPath);

      await createApiCommand('petstore_env', {
        spec: 'petstore.yaml',
        database: 'sqlite',
        port: '4005',
      });

      const projectDir = path.join(workspace, 'petstore_env');
      const env = await fs.readFile(path.join(projectDir, '.env'), 'utf8');
      const envExample = await fs.readFile(path.join(projectDir, '.env.example'), 'utf8');

      expect(env).toMatch(/JWT_SECRET=.+/);
      expect(env).not.toMatch(/CHANGE_THIS_TO_A_SECURE_RANDOM_SECRET_IN_PRODUCTION/);
      expect(envExample).toContain('CHANGE_THIS_TO_A_SECURE_RANDOM_SECRET_IN_PRODUCTION');
      expect(env).toContain('PORT=4005');
    });
  });

  describe('api command — mongodb database', () => {
    it('switches deps to mongoose and emits a mongo db config', async () => {
      const specPath = path.join(workspace, 'petstore.yaml');
      await writeSpec(specPath);

      await createApiCommand('petstore_mongo', {
        spec: 'petstore.yaml',
        database: 'mongodb',
        port: '4006',
      });

      const projectDir = path.join(workspace, 'petstore_mongo');

      const pkg = (await fs.readJson(path.join(projectDir, 'package.json'))) as {
        dependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      expect(pkg.dependencies).toMatchObject({
        mongoose: expect.any(String),
      });
      // Sqlite-specific scripts should be absent.
      expect(pkg.scripts?.['db:migrate']).toBeUndefined();

      const dbConfig = await fs.readFile(
        path.join(projectDir, 'src', 'config', 'database.js'),
        'utf8',
      );
      expect(dbConfig).toContain('mongoose');

      const initJs = await fs.readFile(
        path.join(projectDir, 'src', 'database', 'init.js'),
        'utf8',
      );
      expect(initJs).toContain('mongoose');
      expect(initJs).toContain('MONGODB_URI');
    });
  });

  describe('api command — validation + dry-run paths', () => {
    it('rejects an invalid database type before touching disk', async () => {
      await expect(
        createApiCommand('petstore_bad_db', {
          spec: 'petstore.yaml',
          database: 'oracle',
          port: '4007',
        }),
      ).rejects.toThrow();

      expect(await fs.pathExists(path.join(workspace, 'petstore_bad_db'))).toBe(false);
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it('rejects an out-of-range port', async () => {
      await expect(
        createApiCommand('petstore_bad_port', {
          spec: 'petstore.yaml',
          database: 'sqlite',
          port: '999999',
        }),
      ).rejects.toThrow();

      expect(await fs.pathExists(path.join(workspace, 'petstore_bad_port'))).toBe(false);
    });

    it('fails cleanly when the OpenAPI spec is missing', async () => {
      await expect(
        createApiCommand('petstore_no_spec', {
          spec: 'does-not-exist.yaml',
          database: 'sqlite',
          port: '4008',
        }),
      ).rejects.toThrow();

      // No npm install should be attempted on the failed path.
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it('dry-run reports the planned changes and writes nothing', async () => {
      const specPath = path.join(workspace, 'petstore.yaml');
      await writeSpec(specPath);

      const result = await createApiCommand('petstore_dry', {
        spec: 'petstore.yaml',
        database: 'sqlite',
        port: '4009',
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.name).toBe('petstore_dry');
      expect(result.plannedChanges).toBeDefined();
      expect(result.plannedChanges!.length).toBeGreaterThan(0);
      expect(
        result.plannedChanges!.some(
          (c) => c.op === 'spawn' && c.target === 'npm install',
        ),
      ).toBe(true);

      // Nothing touched the filesystem.
      expect(await fs.pathExists(path.join(workspace, 'petstore_dry'))).toBe(false);
      expect(execSyncMock).not.toHaveBeenCalled();
    });
  });
});
