/**
 * Regression tests for generated-API defects found while dogfooding the
 * `api` command against non-petstore OpenAPI specs (Meridian Station
 * reference app, Phase 0 spikes — see examples/meridian-station/DX-REPORT.md).
 *
 * Each describe block corresponds to one defect that made a freshly
 * generated API fail to boot or serve requests.
 */
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { NameGenerator } = require('../utils/NameGenerator');
const { PathGenerator } = require('../utils/PathGenerator');
const { RouteGenerator } = require('../RouteGenerator/RouteGenerator');
const { ControllerGenerator } = require('../ControllerGenerator/ControllerGenerator');
const { DatabaseAdapter } = require('../ControllerGenerator/adapters/DatabaseAdapter');

/** Spec whose operationIds do NOT coincide with path-derived names. */
const harborSpec = {
  openapi: '3.0.3',
  info: { title: 'Harbormaster', version: '0.1.0' },
  paths: {
    '/berths': {
      get: { operationId: 'list_berths', responses: { 200: { description: 'ok' } } },
      post: { operationId: 'create_berth', responses: { 201: { description: 'created' } } }
    },
    '/berths/{berth_id}': {
      get: {
        operationId: 'get_berth',
        parameters: [{ name: 'berth_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'ok' } }
      }
    },
    '/traffic_schedule': {
      get: { operationId: 'list_traffic', responses: { 200: { description: 'ok' } } }
    }
  }
};

const extractExportedNames = (controllerContent) => {
  const match = controllerContent.match(/module\.exports = \{([^}]*)\}/);
  expect(match).not.toBeNull();
  return match[1].split(',').map((s) => s.trim()).filter(Boolean);
};

const extractImportedNames = (routeContent) => {
  const match = routeContent.match(/const \{([^}]*)\} = require\('\.\.\/controllers\//);
  expect(match).not.toBeNull();
  return match[1].split(',').map((s) => s.trim()).filter(Boolean);
};

describe('generated API regressions (Meridian Phase 0)', () => {
  describe('handler naming: routes and controllers must agree', () => {
    it('generateControllerMethodName prefers operationId when present', () => {
      const name = NameGenerator.generateControllerMethodName(
        'get', 'berths', '/berths', { operationId: 'list_berths' }
      );
      expect(name).toBe('listBerths');
    });

    it('generateControllerMethodName falls back to path-derived names', () => {
      expect(NameGenerator.generateControllerMethodName('get', 'berths', '/berths', {}))
        .toBe('getAllBerths');
      expect(NameGenerator.generateControllerMethodName('get', 'berths', '/berths/{berth_id}'))
        .toBe('getBerthsById');
    });

    it('route imports exactly match controller exports for operationId specs', async () => {
      const dbAdapter = DatabaseAdapter.create('sqlite');
      const resources = ControllerGenerator.groupPathsByResource(harborSpec.paths);
      const pathGroup = resources['berths'];
      const controllerContent = await ControllerGenerator.generateControllerContent(
        'berths', 'Berth', pathGroup, dbAdapter
      );
      const routeContent = RouteGenerator.generateRouteFile(
        Object.entries(harborSpec.paths).filter(([p]) => p.startsWith('/berths')),
        'berths',
        harborSpec
      );

      const exported = extractExportedNames(controllerContent);
      const imported = extractImportedNames(routeContent);
      expect(new Set(exported)).toEqual(new Set(imported));
      expect(exported).toEqual(expect.arrayContaining(['listBerths', 'createBerth', 'getBerth']));
    });
  });

  describe('route index mounting', () => {
    let tmpDir;
    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smt-routes-'));
    });
    afterEach(async () => {
      await fs.remove(tmpDir);
    });

    it('mounts each resource router at its resource path, not the empty path', async () => {
      await RouteGenerator.generateIndexFile(path.join(tmpDir, 'index.js'), [
        { name: 'berths', path: '/berths', camelName: 'berths' },
        { name: 'dockings', path: '/dockings', camelName: 'dockings' }
      ]);
      const content = await fs.readFile(path.join(tmpDir, 'index.js'), 'utf8');
      expect(content).toContain("router.use('/berths', require('./berths.route'));");
      expect(content).toContain("router.use('/dockings', require('./dockings.route'));");
      expect(content).not.toMatch(/router\.use\(''/);
    });

    it('preserves the original resource segment in the mount path (spec-faithful URLs)', async () => {
      await RouteGenerator.generate(tmpDir, harborSpec);
      const content = await fs.readFile(path.join(tmpDir, 'index.js'), 'utf8');
      // BFF (GraphQL Mesh) calls the API with the exact spec paths, so
      // /traffic_schedule must NOT be re-cased to /traffic-schedule.
      expect(content).toContain("'/traffic_schedule'");
      expect(content).not.toContain('/traffic-schedule');
    });
  });

  describe('SQLiteAdapter query generation', () => {
    const adapter = DatabaseAdapter.create('sqlite');

    it('uses the declared path parameter for by-id lookups', () => {
      const query = adapter.generateFindQuery('get', '/berths/{berth_id}');
      expect(query).toContain('req.params.berth_id');
      expect(query).not.toContain('req.params.id');
    });

    it('keeps findByPk for a path parameter literally named id', () => {
      const query = adapter.generateFindQuery('get', '/berths/{id}');
      expect(query).toContain('findByPk(req.params.id)');
    });

    it('does not pass raw req.query as the where clause on list endpoints', () => {
      const query = adapter.generateFindQuery('get', '/berths');
      expect(query).not.toContain('where: req.query');
      // Filter must restrict keys to actual model attributes so pagination
      // params never leak into SQL (`no such column: Berth.limit`).
      expect(query).toContain('rawAttributes');
    });

    it('uses the declared path parameter in update and delete queries', () => {
      expect(adapter.generateUpdateQuery('put', '/berths/{berth_id}')).toContain('berth_id: req.params.berth_id');
      expect(adapter.generateDeleteQuery('/berths/{berth_id}')).toContain('berth_id: req.params.berth_id');
    });
  });

  describe('MongoDBAdapter query generation', () => {
    const adapter = DatabaseAdapter.create('mongodb');

    it('uses findOne on the declared path parameter for business keys', () => {
      const query = adapter.generateFindQuery('get', '/accounts/{accountId}');
      expect(query).toContain('findOne');
      expect(query).toContain('accountId: req.params.accountId');
    });

    it('keeps findById for a path parameter literally named id', () => {
      const query = adapter.generateFindQuery('get', '/accounts/{id}');
      expect(query).toContain('findById(req.params.id)');
    });

    it('does not pass raw req.query as the find filter on list endpoints', () => {
      const query = adapter.generateFindQuery('get', '/accounts');
      expect(query).not.toContain('.find(req.query)');
      expect(query).toContain('schema.paths');
    });

    it('updates and deletes by the declared path parameter', () => {
      expect(adapter.generateUpdateQuery('put', '/accounts/{accountId}')).toContain('accountId: req.params.accountId');
      expect(adapter.generateDeleteQuery('/accounts/{accountId}')).toContain('accountId: req.params.accountId');
    });
  });

  describe('static API templates', () => {
    const templatesDir = path.join(__dirname, '..', '..', 'templates', 'api');

    it('sqlite database module exposes connect/disconnect used by src/index.js', async () => {
      const content = await fs.readFile(
        path.join(templatesDir, 'sqlite', 'src', 'database', 'index.js'), 'utf8'
      );
      expect(content).toMatch(/connect:\s*connectDatabase/);
      expect(content).toMatch(/disconnect:\s*disconnectDatabase/);
    });

    it('db:seed runs seed.js in every variant, never sequelize-cli', async () => {
      for (const variant of ['base', 'sqlite', 'mongodb']) {
        const pkg = await fs.readJson(path.join(templatesDir, variant, 'package.json'));
        if (pkg.scripts && pkg.scripts['db:seed']) {
          expect(pkg.scripts['db:seed']).toBe('node src/database/seed.js');
        }
      }
    });

    it('mongodb connect() is idempotent and never waits for an already-fired event', async () => {
      const content = await fs.readFile(
        path.join(templatesDir, 'mongodb', 'src', 'database', 'index.js'), 'utf8'
      );
      // mongoose.connect() resolves once connected; waiting for a
      // 'connected' event afterwards hangs forever on any valid
      // MONGODB_URI (the event fired before the listener attached).
      expect(content).not.toContain("once('connected'");
      // seed.js calls database.connect() from a process that may already
      // be connected (SEED_DATA=true path) — must be a no-op then.
      expect(content).toContain('readyState === 1');
    });

    it('SEED_DATA path runs ./database/seeds directly, never the standalone seed.js', async () => {
      const content = await fs.readFile(
        path.join(templatesDir, 'base', 'src', 'index.js'), 'utf8'
      );
      // seed.js is the standalone entry: it connects AND disconnects.
      // Running it in-process would tear down the server's own connection.
      expect(content).toContain("require('./database/seeds')");
      expect(content).not.toContain("require('./database/seed')");
    });

    it('seed.js connects and runs the generated ./seeds runner in every variant', async () => {
      for (const variant of ['base', 'sqlite', 'mongodb']) {
        const content = await fs.readFile(
          path.join(templatesDir, variant, 'src', 'database', 'seed.js'), 'utf8'
        );
        expect(content).toContain("require('./seeds')");
        expect(content).toContain('database.connect()');
      }
    });
  });

  describe('Angular MFE template', () => {
    it('tsconfig.app.json has no "//" pseudo-comment key inside compilerOptions', async () => {
      const tsconfigPath = path.join(
        __dirname, '..', '..', '..', '..', 'packages', 'codegen', 'templates',
        'base-mfe-angular', 'tsconfig.app.json.ejs'
      );
      const content = await fs.readFile(tsconfigPath, 'utf8');
      // "//" keys are rejected by Angular's tsconfig parser (TS5023);
      // JSONC line comments are the supported way to annotate.
      expect(content).not.toMatch(/"\/\/"\s*:/);
    });
  });
});
