# GitHub Copilot Instructions

## Project Overview

**seans-mfe-tool** is a CLI tool for scaffolding Module Federation micro-frontend applications. It generates shell apps, remote MFEs, and full-stack APIs from OpenAPI specs, with integrated orchestration capabilities for runtime MFE discovery and composition.

**Two parallel architectures exist:**

1. **CLI/CodeGen** (production-ready): Generates MFE projects with rspack/Module Federation
2. **Agent Orchestrator** (design phase): Browser-based dynamic MFE loading system (`src/agent-orchestrator/`)

Focus on **CLI/CodeGen** for implementation work. Reference `docs/architecture-decisions.md` ADR-009 through ADR-021 for orchestration design principles.

## Architecture & Key Components

### CLI Commands Structure (`bin/seans-mfe-tool.js`)

```bash
mfe shell <name>      # Shell (host) with orchestration service
mfe remote <name>     # Remote MFE (Module Federation)
mfe api <name>        # Full-stack API from OpenAPI spec
mfe init <name>       # Workspace (remotes only, no shell)
mfe build <name>      # Build with rspack
mfe deploy <name>     # Docker/K8s deployment
```

**Command removed:** `analyze` (ADR-021) - use runtime DSL discovery instead

### Code Generation Flow

1. **Template Resolution** (`src/templates/`)

   - `react/shell/` - Host application with orchestration
   - `react/remote/` - Federated module with auto-registration
   - `api/base/` - Express + OpenAPI + DB layers

2. **Template Processing** (`src/utils/templateProcessor.js`)

   - Recursively processes `.ejs` files
   - Variable substitution: `<%= name %>`, `<%= port %>`, etc.
   - Preserves directory structure

3. **Code Generation Utilities**
   - `src/codegen/ControllerGenerator/` - REST controllers from OpenAPI paths
   - `src/codegen/DatabaseGenerator/` - MongoDB schemas or SQLite migrations
   - `src/codegen/RouteGenerator/` - Express route wiring

### Module Federation Integration

**rspack.config.js patterns** (generated):

```javascript
// Shell exposes orchestration, consumes remotes
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    remote1: 'remote1@http://localhost:3001/remoteEntry.js',
  },
  shared: ['react', 'react-dom', '@mui/material'], // Singleton dependencies
});

// Remote exposes components
new ModuleFederationPlugin({
  name: 'remote1',
  filename: 'remoteEntry.js',
  exposes: {
    './App': './src/App.tsx',
  },
  shared: { react: { singleton: true } },
});
```

**Critical:** Shared dependencies use `singleton: true` for React/MUI to prevent version conflicts

### API Generation from OpenAPI

`src/commands/create-api.js` → Full stack in one command:

1. **Parse OpenAPI** (`@apidevtools/swagger-parser`)
2. **Generate Models** - Schemas from `#/components/schemas`
3. **Generate Controllers** - CRUD endpoints from `paths`
4. **Generate Routes** - Express router wiring
5. **Database Layer**
   - **MongoDB**: Schema versioning, migrations, seeding (`src/codegen/DatabaseGenerator/MongoDBGenerator.js`)
   - **SQLite**: File-based storage, migrations (`src/codegen/DatabaseGenerator/SQLiteGenerator.js`)

**Example:** `examples/bizcase-api/` shows generated API structure

## Development Patterns

### Testing with Jest

- **Config:** `jest.config.js` - Node environment, Babel transform
- **Pattern:** Tests in `__tests__/` directories adjacent to source
- **Mocking:** `src/commands/__tests__/test-utils.js` provides common mocks (fs, exec, console)
- **Coverage:** Run `npm test -- --coverage` (targets 80% in CI)

**Test structure:**

```javascript
const { setupCommonMocks, mockFs, mockExec } = require('./test-utils');

describe('CommandName', () => {
  setupCommonMocks();

  it('should generate project structure', async () => {
    await commandFunction('test-name', options);
    expect(mockFs.ensureDir).toHaveBeenCalled();
    expect(mockExec.execSync).toHaveBeenCalledWith('npm install', ...);
  });
});
```

### Template Development

When adding new templates:

1. Place in `src/templates/{type}/{name}/`
2. Use `.ejs` extension for variable substitution
3. Reference variables: `<%= name %>`, `<%= port %>`, `<%= muiVersion %>`
4. Update command to pass variables to `processTemplates()`

### Error Handling

**CLI commands use try-catch with chalk:**

```javascript
try {
  // Command logic
  console.log(chalk.green('✓ Success message'));
} catch (error) {
  console.error(chalk.red('\n✗ Failed:'));
  console.error(chalk.red(error.message));
  throw error; // Re-throw for exit code
}
```

## Orchestration Design (Implementation Phase)

### DSL-Driven Architecture (ADR-013, ADR-018)

**Every MFE exposes DSL at `/.well-known/mfe-manifest.yaml`:**

```yaml
name: csv-analyzer
version: 1.0.0
type: tool
capabilities:
  - data-analysis:
      inputs:
        - name: file
          type: file
          formats: [csv]
      outputs:
        - name: report
          type: object
      lifecycle:
        - before: [validateFile]
        - main: [processData]
        - after: [generateReport]
remoteEntry: http://localhost:3002/remoteEntry.js
```

### Hybrid Orchestration (ADR-009, ADR-016, ADR-017)

**Two-layer system:**

1. **Orchestration Service** (Node.js, Docker-only)

   - Registry storage (Redis/memory)
   - REST API: `/api/register`, `/api/discover`
   - WebSocket: Real-time registry updates
   - **Generated WITH every shell** (`mfe shell` creates both)

2. **Shell Runtime** (Browser)
   - Local registry cache
   - Module Federation loader
   - On-demand DSL fetch
   - Three-phase discovery (ADR-011)

**Development workflow:**

```bash
cd my-shell
docker-compose up -d      # Shell + orchestration service
cd ../my-remote
npm run dev               # Dev server, auto-registers with :3100
```

### Auto-Registration Pattern (ADR-012)

**CLI generates registration code:**

```javascript
// Auto-generated in src/orchestration/register.ts
export async function registerMFE() {
  const registration = {
    name: 'feature-a',
    endpoint: process.env.MFE_ENDPOINT || 'http://localhost:3001',
    remoteEntry: 'http://localhost:3001/remoteEntry.js',
    dslEndpoint: `${endpoint}/.well-known/mfe-manifest.yaml`,
    healthCheck: `${endpoint}/health`,
  };

  await fetch(`${orchestrationUrl}/api/register`, {
    method: 'POST',
    body: JSON.stringify(registration),
  });
}

// Called on startup
if (process.env.NODE_ENV !== 'test') {
  registerMFE().catch(console.error);
}
```

### Three-Phase Discovery (ADR-011)

AI agents choose discovery strategy:

- **Phase A (Probabilistic)**: Fetch all DSLs, agent reasons
- **Phase C (Semantic)**: Natural language query → ranked results
- **Phase B (Deterministic)**: Query DSL filtering

## Code Style & Conventions

### JavaScript (Current Codebase)

- **Node.js modules:** Use `require()` and `module.exports`
- **Async/await:** Preferred over callbacks/promises chains
- **Validation:** Early return with error messages
- **Path resolution:** Always use `path.resolve()` for absolute paths
- **Console output:** Use `chalk` for colored messages (green=success, red=error, blue=info)

```javascript
// Pattern: Validate inputs first
function validatePort(port) {
  const n = typeof port === 'string' ? Number(port) : port;
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error('Invalid port');
  }
  return n;
}

// Pattern: Template processing
const targetDir = path.resolve(process.cwd(), name);
await fs.copy(templateDir, targetDir);
await processTemplates(targetDir, { name, port, muiVersion });
```

### TypeScript (Orchestrator - Future)

- Use strict typing - no `any` types
- Prefer interfaces over type aliases for object shapes
- Explicit return types on all public methods
- Naming: `IInterfaceName` for interfaces (e.g., `IAgent`, `IEventBus`)

## Working with This Codebase

### Adding a New CLI Command

1. **Create command file:** `src/commands/my-command.js`

   ```javascript
   async function myCommand(name, options) {
     const templateDir = path.resolve(__dirname, '..', 'templates', 'my-type');
     // ... validation, copy, process
     execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
   }
   module.exports = { myCommand };
   ```

2. **Register in CLI:** `bin/seans-mfe-tool.js`

   ```javascript
   program
     .command('my-command')
     .description('Description')
     .argument('<name>', 'Name')
     .option('-p, --port <port>', 'Port', '3000')
     .action((name, options) => {
       myCommand(name, options);
     });
   ```

3. **Add tests:** `src/commands/__tests__/my-command.test.js`

### Adding to Generated Templates

**Modify template structure:**

```
src/templates/react/remote/
├── package.json.ejs          # <%= name %>, <%= port %>
├── rspack.config.js.ejs      # Module Federation config
├── src/
│   ├── App.tsx.ejs
│   └── index.tsx
└── public/
    └── index.html.ejs
```

**Variable substitution:**

- Use `<%= variable %>` for escaped HTML
- Use `<%- variable %>` for unescaped (JSON objects)
- Access nested: `<%= config.remotes['remote1'] %>`

### Extending API Generation

**Add new database type:**

1. Create generator: `src/codegen/DatabaseGenerator/MyDBGenerator.js`
2. Implement interface:
   ```javascript
   class MyDBGenerator {
     async generateModels(schemas, outputDir) {}
     async generateMigrations(schemas, outputDir) {}
     async generateSeeds(schemas, exampleData, outputDir) {}
   }
   ```
3. Register in `create-api.js`:
   ```javascript
   const generators = {
     mongodb: MongoDBGenerator,
     sqlite: SQLiteGenerator,
     mydb: MyDBGenerator,
   };
   ```

### Understanding Module Federation Config

**Shell (host) pattern:**

```javascript
remotes: {
  'remote-name': 'remoteName@http://host:port/remoteEntry.js'
  //              ↑ global    ↑ URL to federated module
  //                scope
}
```

**Remote pattern:**

```javascript
exposes: {
  './ComponentName': './src/path/to/Component'
  // ↑ Public name    ↑ Local file path
}
```

**Shared dependencies:**

- React/React-DOM: `singleton: true` (prevents duplicate instances)
- MUI: `singleton: true` (theme consistency)
- Utilities: Can be duplicated per MFE

### Running Tests Locally

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
npm test create-shell      # Specific test file

# CI mode (strict thresholds)
CI=1 npm test
```

### Debugging Generated Projects

1. **Check template variables:**

   - Add `console.log(vars)` before `processTemplates()`
   - Inspect generated `package.json` for correct substitution

2. **Verify file structure:**

   ```javascript
   const { list_dir } = require('./utils');
   await list_dir(targetDir); // Check what was generated
   ```

3. **Test Module Federation:**
   - Start shell: `cd my-shell && npm start`
   - Start remote: `cd my-remote && npm start`
   - Open browser console, check for federation errors
   - Look for `Uncaught Error: Shared module is not available for eager consumption`

## Common Pitfalls & Solutions

### Module Federation

**Problem:** "Shared module not available"

- **Cause:** Missing `singleton: true` for React
- **Fix:** Ensure both shell and remote share React with `singleton: true`

**Problem:** Remote not loading

- **Cause:** CORS or wrong URL
- **Fix:** Check remoteEntry URL in shell's rspack.config, verify remote is running

### Template Generation

**Problem:** Variables not substituting

- **Cause:** Missing `.ejs` extension
- **Fix:** Rename file to `filename.ext.ejs` (e.g., `package.json.ejs`)

**Problem:** npm install fails

- **Cause:** Invalid package.json from template errors
- **Fix:** Validate JSON syntax in template, check variable escaping

### API Generation

**Problem:** OpenAPI parsing fails

- **Cause:** Invalid spec or unsupported features
- **Fix:** Validate spec at https://editor.swagger.io, check console for specifics

**Problem:** Database connection errors

- **Cause:** Missing environment variables
- **Fix:** Check generated `.env.example`, ensure `DATABASE_URL` set

## ADR Quick Reference

### Runtime & Platform Handlers (Active Implementation)

- **ADR-059**: Platform Handler Interface & Execution Model ← **Issues #47-59**
- **ADR-060**: Load Capability - Atomic Operation Design ← **Issues #47-59**
- **ADR-061**: Error Boundary & Fallback UI Strategy (pending)

### Orchestration Features

- **ADR-009**: Hybrid architecture (centralized service + shell runtime)
- **ADR-010**: Lightweight registry (metadata only, fetch DSL on-demand)
- **ADR-011**: Three-phase discovery (A→C→B)
- **ADR-012**: Push-based registration (auto-generated code)
- **ADR-013**: Language-agnostic DSL (YAML/JSON)
- **ADR-016**: Orchestration service per shell
- **ADR-017**: Docker-only orchestration, dev servers for MFEs
- **ADR-018**: Abstract MFE base class (standard capabilities)
- **ADR-019**: JWT-based authorization
- **ADR-020**: `mfe init` = workspace only, shell = explicit
- **ADR-021**: `analyze` command removed (use runtime DSL)

**Full details:** `docs/architecture-decisions/` directory

## Testing Strategy (TDD Required)

Every new feature starts with a failing test:

```javascript
describe('NewFeature', () => {
  it('should handle expected case', async () => {
    // Arrange - setup test data
    // Act - call the method
    // Assert - verify results
  });

  it('should handle error case', async () => {
    // Test error paths
  });
});
```

## File Organization Patterns

```
src/
├── commands/          # CLI command implementations
│   ├── create-*.js   # Generators (shell, remote, api)
│   └── __tests__/    # Command tests
├── templates/         # EJS templates for code generation
│   ├── api/
│   ├── docker/
│   └── react/
├── codegen/          # Code generation utilities
│   ├── ControllerGenerator/
│   ├── DatabaseGenerator/
│   └── RouteGenerator/
├── utils/            # Shared utilities
│   ├── templateProcessor.js
│   └── securityUtils.js
└── agent-orchestrator/  # Future: browser runtime (design only)
```

## Environment-Specific Notes

### Local Development

- CLI installed globally: `npm link` in project root
- Test with: `mfe <command> <args>`
- Cleanup test outputs: `npm run clean:test-workspaces`

### CI/CD (GitHub Actions)

- Jest runs in CI mode (strict coverage thresholds: 80%)
- Tests must be deterministic (no reliance on external services)
- Use mocks from `test-utils.js`

## Getting Help

- **Architecture decisions:** `docs/architecture-decisions.md` (ADR-001 through ADR-021+)
- **Orchestration requirements:** `docs/orchestration-requirements.md`
- **API generation:** `docs/api-generator-readme.md`
- **Examples:** `examples/` directory (working projects)
- **Agent system design:** `src/agent-orchestrator/README.md` (future work)
- **GitHub Issues:** [Live backlog](https://github.com/falese/seans-mfe-tool/issues)
  - **Runtime Platform:** Issues #47-59 (REQ-RUNTIME-001 through 012)
  - Query with: `gh issue list --search "REQ-RUNTIME" --state open`
  - Use Requirements Elicitation Agent for complex queries
- **BACKLOG.md (deprecated):** `docs/BACKLOG.md` - Historical reference only, see GitHub Issues for current work

## Requirements & Issue Tracking

### Traceability System

Every feature follows a traceable path from requirements → implementation → verification:

```
Requirements Doc (REQ-XXX)
    ↓
ADR (ADR-NNN) ← Architectural decisions
    ↓
GitHub Issue (#NNN) ← Direct creation in GitHub
    ↓
Implementation (PR)
    ↓
Acceptance Criteria (docs/acceptance-criteria/*.feature)
    ↓
Requirements Update (Status: ✅ Complete)
```

### Working with Requirements

**Locating Requirements:**

- **Runtime Platform:** `docs/runtime-requirements.md` (REQ-RUNTIME-001 to REQ-RUNTIME-012) ← **Active Implementation**
- **Orchestration:** `docs/orchestration-requirements.md` (REQ-001 to REQ-041)
- **BFF:** `docs/graphql-bff-requirements.md` (REQ-BFF-001 to REQ-BFF-008)
- **DSL Contract:** `docs/dsl-contract-requirements.md` (REQ-042 to REQ-053)
- **Remote Generation:** `docs/dsl-remote-requirements.md` (REQ-REMOTE-001 to REQ-REMOTE-010)
- **Scaffolding:** `docs/scaffolding-requirements.md` (REQ-SCAFFOLD-001 to REQ-SCAFFOLD-006)

**Requirement Document Status:**

- 📋 **Planned**: Requirements defined, not yet implemented
- 🟡 **In Progress**: Active implementation work
- ✅ **Complete**: Implemented and verified
- 🔶 **Deferred**: Postponed for future consideration

**When Implementing a Feature:**

1. **Find the requirement**: Search `docs/*-requirements.md` for REQ-XXX
2. **Check ADRs**: Look for related architectural decisions
3. **Query GitHub Issues**: Use Requirements Elicitation Agent to find related issues
4. **Implement with traceability**: Reference REQ-XXX and issue number in commits
5. **Update status**: Mark requirement as implemented when complete
6. **Link artifacts**: Update requirements doc with PR/issue links

### Referencing Requirements in Code

Use consistent comments to link code to requirements:

```typescript
// REQ-042: Lifecycle hook execution semantics
// Implements mandatory and contained flags per ADR-036
async function executeHook(hook: Hook, context: Context): Promise<void> {
  // ...
}
```

```yaml
# REQ-BFF-001: DSL data section as Mesh configuration
# ADR-046: GraphQL Mesh with DSL-embedded config
data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
```

### Creating GitHub Issues

When a requirement is ready for implementation:

1. **Query for duplicates**: Use Requirements Elicitation Agent to search existing issues
2. **Use issue templates**: `.github/ISSUE_TEMPLATE/` (feature.yml, requirement.yml, bug.yml)
3. **Apply labels**: Use standard label system (priority, type, component, req)
4. **Link requirements**: Reference REQ-XXX, ADR-NNN, acceptance files
5. **Create via GitHub CLI**: Use `gh issue create` with `--body-file` for multiline content
6. **Update requirements**: Add issue number to requirements doc after creation

**Preferred CLI Pattern for Issue Creation:**

```bash
# Using --body-file with process substitution for multiline bodies
gh issue create \
  --title "REQ-XXX: Feature Title" \
  --body-file <(cat <<'EOF'
## Requirement
Implement REQ-XXX from docs/requirements-file.md

## Description
[Detailed description]

## Acceptance Criteria
- Criterion 1
- Criterion 2

## Related Documentation
- [REQ-XXX](link)
- [ADR-NNN](link)

## Implementation Notes
- Depends on: REQ-YYY
- Create src/path/to/file.ts
EOF
)
```

**Batch Issue Creation:**
- For multiple issues, use 3-second delays between creates: `sleep 3`
- Verify creation: `gh issue list --search "REQ-XXX" --state open`
- Close duplicates immediately: `gh issue close N --comment "Duplicate of #M"`

### Acceptance Criteria Files

GWT (Given-When-Then) scenarios in `docs/acceptance-criteria/`:

- `runtime-load-render.feature` - Load/Render capabilities and platform handlers ← **Active**
- `remote-mfe.feature` - Remote generation and federation
- `bff.feature` - GraphQL BFF and Mesh integration
- `lifecycle-hooks.feature` - DSL lifecycle hook execution
- `platform-handlers.feature` - Platform handler patterns
- `type-system.feature` - DSL type system validation

**When adding features:**

1. Create or update `.feature` file with scenarios
2. Reference in requirements doc and GitHub Issue
3. Implement feature to satisfy scenarios
4. Run manual or automated tests against scenarios

## Active Implementation: Runtime Platform Handlers

**Current Focus:** Issues #47-59 (REQ-RUNTIME-001 through 012)

### Implementation Priority Order

Follow this sequence for runtime platform handler implementation:

1. **#49 - REQ-RUNTIME-002**: Shared Context (foundation for all capabilities)
   - File: `src/runtime/base-mfe.ts` - Context class with TypeScript interfaces
   - No dependencies, must be implemented first

2. **#52 - REQ-RUNTIME-005**: Platform Handler Registry
   - File: `src/runtime/handlers/PlatformHandlerRegistry.ts`
   - Depends on: #49 (Context)
   - Enables all handler implementations

3. **#47 - REQ-RUNTIME-001**: Load Capability (atomic operation)
   - File: `src/runtime/base-mfe.ts` - BaseMFE.load() method
   - Depends on: #49, #52
   - See: ADR-060 for atomic operation design

4. **#51 - REQ-RUNTIME-004**: Render Capability
   - File: `src/runtime/base-mfe.ts` - BaseMFE.render() method
   - Depends on: #47, #49
   - React 18 createRoot() integration

5. **#53 - REQ-RUNTIME-006**: Auth Handler (JWT validation)
   - File: `src/runtime/handlers/auth.ts`
   - Depends on: #52
   - Use `jsonwebtoken` library

6. **#56 - REQ-RUNTIME-009**: Error Handling Handler
   - File: `src/runtime/handlers/error-handling.ts`
   - Depends on: #52
   - Exponential backoff retry logic

7-12. **Remaining Handlers** (can be implemented in parallel):
   - #54: Validation Handler (`src/runtime/handlers/validation.ts`)
   - #55: Telemetry Handler (`src/runtime/handlers/telemetry.ts`)
   - #57: Caching Handler (`src/runtime/handlers/caching.ts`)
   - #50: Load Result Validation (refinement)
   - #58: Error Boundaries & Fallback UI
   - #59: Telemetry Emission Points

### Runtime Implementation Patterns

**Test-Driven Development:**
- Write Gherkin scenario from `docs/acceptance-criteria/runtime-load-render.feature`
- Convert to Jest test in `src/runtime/__tests__/`
- Implement feature to pass test
- Target 100% coverage per ADR-059

**TypeScript Strict Mode:**
- All runtime code uses TypeScript strict mode
- No `any` types allowed
- Explicit return types on all public methods
- Interface naming: `Context`, `LoadResult`, `RenderResult`, `PlatformHandler`

**Handler Development Pattern:**
```typescript
// src/runtime/handlers/example.ts
import { PlatformHandler } from './PlatformHandlerRegistry';
import { Context } from '../base-mfe';

export class ExampleHandler implements PlatformHandler {
  readonly name = 'example';
  readonly phases = ['before', 'main', 'after'];
  readonly errorConfig = { continueOnError: false, retryable: true };

  async execute(context: Context, phase: string): Promise<void> {
    // Handler logic here
    // Can mutate context for cross-handler communication
  }
}
```

**Query Active Runtime Issues:**
```bash
# All runtime issues
gh issue list --search "REQ-RUNTIME" --state open

# High priority only
gh issue list --search "REQ-RUNTIME" --label "priority-high" --state open

# Specific requirement
gh issue view 49  # REQ-RUNTIME-002
```

## Deprecated Features

- ~~`mfe analyze`~~ - Removed per ADR-021 (use runtime DSL discovery instead)
- See `README.md` "Deprecated / Removed Commands" section for migration guidance
