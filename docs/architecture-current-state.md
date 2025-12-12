# seans-mfe-tool - Current Architecture (December 2025)

## System Overview

```mermaid
graph TB
    subgraph "CLI Entry Point"
        CLI["bin/seans-mfe-tool.js<br/>Commander.js CLI"]
    end

    subgraph "Command Layer"
        RemoteGen["remote-generate.ts<br/>Generate MFE Projects"]
        RemoteInit["remote-init.ts<br/>Initialize Workspace"]
        BFF["bff.ts<br/>BFF Management"]
        API["create-api.js<br/>API Generation"]
        Deploy["deploy.js<br/>Docker/K8s Deploy"]
    end

    subgraph "Code Generation Engine"
        UnifiedGen[UnifiedGenerator<br/>Main Orchestrator]
        APIGen[APIGenerator<br/>REST API Codegen]
        Templates[Template Engine<br/>EJS Processing]
    end

    subgraph "DSL & Validation"
        DSL["DSL Schema<br/>mfe-manifest.yaml"]
        Parser["YAML Parser"]
        Validator[Schema Validator]
        TypeSystem[Type System]
    end

    subgraph "Runtime Platform"
        BaseMFE[BaseMFE<br/>Abstract Base Class]
        RemoteMFE[RemoteMFE<br/>Module Federation]
        Context[Context<br/>Shared State]
        Handlers[Platform Handlers<br/>Auth, Telemetry, etc.]
    end

    subgraph "Templates"
        ReactTemplates["React/TypeScript<br/>Components, Features"]
        BFFTemplates["BFF Server<br/>GraphQL Mesh"]
        ConfigTemplates["Configuration<br/>rspack, Docker, etc."]
    end

    subgraph "Utilities"
        TemplateProc[Template Processor<br/>EJS Rendering]
        Security[Security Utils<br/>JWT, Validation]
        ManifestVal[Manifest Validator]
    end

    subgraph "Generated Output"
        MFEProject["Complete MFE Project<br/>src/, config, server.ts"]
        APIProject["REST API Project<br/>Express + DB + Routes"]
    end

    subgraph "Examples"
        E2E[e2e-mfe<br/>Full Example]
        E2E2[e2e2<br/>Extended Example]
        DSLMFE[dsl-mfe<br/>DSL Showcase]
        BizcaseAPI[bizcase-api<br/>Generated API]
    end

    subgraph "Build Artifacts"
        RuntimePkg["dist/runtime/<br/>@seans-mfe-tool/runtime"]
    end

    %% Connections
    CLI --> RemoteGen
    CLI --> RemoteInit
    CLI --> BFF
    CLI --> API
    CLI --> Deploy

    RemoteGen --> UnifiedGen
    RemoteInit --> UnifiedGen
    BFF --> UnifiedGen
    API --> APIGen

    UnifiedGen --> DSL
    UnifiedGen --> Templates
    UnifiedGen --> TemplateProc

    APIGen --> Templates
    APIGen --> Security

    DSL --> Parser
    DSL --> Validator
    DSL --> TypeSystem

    Templates --> ReactTemplates
    Templates --> BFFTemplates
    Templates --> ConfigTemplates

    UnifiedGen --> MFEProject
    APIGen --> APIProject

    MFEProject --> E2E
    MFEProject --> E2E2
    MFEProject --> DSLMFE
    APIProject --> BizcaseAPI

    BaseMFE --> RemoteMFE
    BaseMFE --> Context
    BaseMFE --> Handlers

    RuntimePkg --> BaseMFE
    RuntimePkg --> RemoteMFE
    RuntimePkg --> Context

    MFEProject -.->|uses at runtime| RuntimePkg

    style CLI fill:#4A90E2,color:#fff
    style UnifiedGen fill:#7ED321,color:#000
    style APIGen fill:#7ED321,color:#000
    style DSL fill:#F5A623,color:#000
    style BaseMFE fill:#BD10E0,color:#fff
    style RuntimePkg fill:#50E3C2,color:#000
    style MFEProject fill:#9013FE,color:#fff
    style E2E fill:#F8E71C,color:#000
```

## Detailed Module Breakdown

### 1. CLI Entry Point

**Location**: `bin/seans-mfe-tool.js`

- Commander.js-based CLI
- Route commands to handlers
- Parse arguments and options

**Commands Available**:

- `mfe remote:generate` - Generate complete MFE project
- `mfe remote:init` - Initialize workspace structure
- `mfe bff:*` - BFF management (validate, build, dev)
- `mfe api` - Generate API from OpenAPI spec
- `mfe deploy` - Docker/K8s deployment

### 2. Command Layer

**Location**: `src/commands/`

#### remote-generate.ts

- Orchestrates MFE project generation
- Reads mfe-manifest.yaml
- Calls UnifiedGenerator
- Installs dependencies

#### remote-init.ts

- Creates workspace structure
- Initializes git repository
- Sets up basic configuration

#### bff.ts

- Extracts GraphQL Mesh config from DSL
- Generates .meshrc.yaml
- Manages Mesh CLI (validate, build, dev)
- Handles JWT authentication forwarding

#### create-api.js

- Parses OpenAPI specifications
- Generates Express REST API
- Creates database models (MongoDB/SQLite)
- Generates controllers and routes

#### deploy.js

- Docker container build
- Kubernetes manifest generation
- Deployment orchestration

### 3. Code Generation Engine

**Location**: `src/codegen/`

#### UnifiedGenerator

**Location**: `src/codegen/UnifiedGenerator/unified-generator.ts`

- **Purpose**: Main orchestrator for MFE generation
- **Responsibilities**:
  - Parse DSL manifest
  - Extract capabilities
  - Generate feature components
  - Generate platform code (base-mfe, bff)
  - Generate configuration files
  - Render templates with variables

**Key Functions**:

- `generateAllFiles()` - Main entry point
- `generateFeatureComponents()` - Domain capabilities → React components
- `generatePlatformCode()` - Runtime integration code
- `generateBFFServer()` - GraphQL Mesh server
- `generateConfigs()` - rspack, TypeScript, Docker configs

#### APIGenerator

**Location**: `src/codegen/APIGenerator/`

- **ControllerGenerator**: REST endpoint implementations
- **RouteGenerator**: Express route wiring
- **DatabaseGenerator**:
  - MongoDB: Schemas, migrations, seeding
  - SQLite: File-based storage, migrations

### 4. DSL & Validation

**Location**: `src/dsl/`

#### schema.ts

- Complete DSL type definitions
- Manifest structure (name, version, capabilities, data)
- Capability types (platform vs domain)
- Lifecycle hooks structure

#### validator.ts

- Schema validation (Zod-based)
- Capability validation
- Data source validation
- Type checking

#### type-system.ts

- DSL type system implementation
- Type inference
- Type compatibility checking

#### parser.ts

- YAML parsing
- Manifest loading
- Error handling

### 5. Runtime Platform

**Location**: `src/runtime/`
**Output**: `dist/runtime/` → `@seans-mfe-tool/runtime` npm package

#### base-mfe.ts

- **BaseMFE**: Abstract base class for all MFEs
- Lifecycle methods: `load()`, `render()`, `health()`, `describe()`, `schema()`
- Template method pattern (do\* methods)
- Context integration (REQ-RUNTIME-002)

#### remote-mfe.ts

- **RemoteMFE**: Concrete implementation for Module Federation
- Module Federation integration
- Container mounting/unmounting
- Telemetry tracking
- Error boundaries

#### context.ts

- **Context**: Shared state across lifecycle phases
- User context (auth, permissions)
- Telemetry events
- Validation errors
- Factory pattern for context creation

#### handlers/

**Platform handlers** (REQ-RUNTIME-001 through 012):

- `auth.ts` - JWT validation
- `telemetry.ts` - Event tracking
- `error-handling.ts` - Retry logic, exponential backoff
- `validation.ts` - Input validation
- `caching.ts` - Response caching
- `rate-limiting.ts` - Rate limiting

### 6. Templates

**Location**: `src/codegen/templates/`

#### React Templates

**Location**: `templates/react/`

- Component templates (features)
- Index.tsx (standalone entry)
- Remote.tsx (Module Federation entry)
- App.tsx (main component)

#### BFF Templates

**Location**: `templates/bff/`

- `server.ts.ejs` - Express + GraphQL Mesh
- Mesh context injection
- JWT forwarding
- Health checks
- Static asset serving

#### Configuration Templates

- `rspack.config.js.ejs` - Module Federation config
- `tsconfig.json.ejs` - TypeScript configuration
- `Dockerfile.ejs` - Docker containerization
- `docker-compose.yaml.ejs` - Multi-service orchestration
- `.meshrc.yaml.ejs` - GraphQL Mesh configuration

### 7. Utilities

**Location**: `src/utils/`

#### templateProcessor.js

- EJS template rendering
- Variable substitution
- Recursive directory processing

#### securityUtils.js

- JWT token handling
- Authentication helpers
- Security validation

#### manifestValidator.js

- Manifest structure validation
- Capability validation
- Data source validation

### 8. Examples

**Location**: `examples/`

#### e2e-mfe

- Full-featured MFE example
- DataAnalysis, ReportViewer, DataAnalysisDetailed capabilities
- BFF with GraphQL Mesh
- Module Federation configured
- Uses runtime package

#### e2e2

- Extended example
- Additional ShareReports capability
- Demonstrates multi-capability MFE
- Full BFF integration

#### dsl-mfe

- DSL showcase
- Minimal configuration
- Reference implementation

#### bizcase-api

- Generated REST API example
- Express + MongoDB
- Controllers, routes, models
- Generated from OpenAPI spec

### 9. Build Artifacts

**Location**: `dist/`

#### dist/runtime/

- Compiled runtime package
- npm-publishable
- Used by generated MFEs
- Exports: BaseMFE, RemoteMFE, Context
- **Important**: Handlers NOT in default export (prevents jsonwebtoken bundling)

### 10. Agent Orchestrator (Design Phase)

**Location**: `src/agent-orchestrator/`

- Future: Browser-based dynamic MFE loading
- Design documentation only
- Not yet implemented

## Data Flow: MFE Generation

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CLI as CLI
    participant Parser as DSL Parser
    participant UnifiedGen as Unified Generator
    participant Templates as Template Engine
    participant Output as File System
    participant Runtime as Runtime Package

    Dev->>CLI: mfe remote:generate
    CLI->>Parser: Read mfe-manifest.yaml
    Parser->>Parser: Validate DSL schema
    Parser-->>CLI: Validated manifest

    CLI->>UnifiedGen: generateAllFiles(manifest)

    UnifiedGen->>UnifiedGen: Extract capabilities
    UnifiedGen->>Templates: Render feature components
    Templates-->>UnifiedGen: React components (.tsx)

    UnifiedGen->>Templates: Render platform code
    Templates-->>UnifiedGen: base-mfe, bff code

    UnifiedGen->>Templates: Render BFF server
    Templates-->>UnifiedGen: server.ts with Mesh

    UnifiedGen->>Templates: Render configs
    Templates-->>UnifiedGen: rspack, Docker, etc.

    UnifiedGen->>Output: Write all files

    CLI->>CLI: npm install
    CLI->>CLI: mesh build

    CLI-->>Dev: ✓ Project ready

    Note over Output,Runtime: Generated project imports<br/>@seans-mfe-tool/runtime
```

## Data Flow: BFF Integration

```mermaid
graph LR
    subgraph "DSL Manifest"
        DataSection[data:<br/>sources, transforms, plugins]
    end

    subgraph "Code Generation"
        ExtractMesh[extractMeshConfig()]
        RenderTemplate[Render server.ts.ejs]
    end

    subgraph "Generated Files"
        MeshRC[.meshrc.yaml]
        ServerTS[server.ts]
    end

    subgraph "Runtime"
        MeshBuild[mesh build]
        MeshIndex[.mesh/index.ts]
        ExpressServer[Express Server]
        GraphQL[GraphQL Endpoint]
    end

    DataSection -->|Extract| ExtractMesh
    ExtractMesh -->|Write| MeshRC
    DataSection -->|Variables| RenderTemplate
    RenderTemplate -->|Generate| ServerTS

    MeshRC -->|Read by| MeshBuild
    MeshBuild -->|Generate| MeshIndex

    ServerTS -->|Import| MeshIndex
    ServerTS -->|Creates| ExpressServer
    ExpressServer -->|Exposes| GraphQL

    style DataSection fill:#F5A623
    style MeshRC fill:#7ED321
    style ServerTS fill:#BD10E0
    style GraphQL fill:#50E3C2
```

## Module Dependencies

```mermaid
graph TB
    CLI[CLI Entry]
    Commands[Commands Layer]
    UnifiedGen[Unified Generator]
    APIGen[API Generator]
    Templates[Templates]
    DSL[DSL Schema]
    Runtime[Runtime Package]
    Utils[Utilities]

    CLI --> Commands
    Commands --> UnifiedGen
    Commands --> APIGen
    Commands --> Utils

    UnifiedGen --> DSL
    UnifiedGen --> Templates
    UnifiedGen --> Utils

    APIGen --> Templates
    APIGen --> Utils

    Runtime --> DSL

    Templates -.->|Referenced by| UnifiedGen
    Templates -.->|Referenced by| APIGen

    style CLI fill:#4A90E2,color:#fff
    style UnifiedGen fill:#7ED321
    style Runtime fill:#BD10E0,color:#fff
    style DSL fill:#F5A623
```

## Technology Stack

### CLI & Build Tools

- **Commander.js** - CLI framework
- **TypeScript** - Type safety for runtime
- **JavaScript (Node.js)** - CLI commands and generators
- **Jest** - Testing framework
- **EJS** - Template engine

### Generated MFE Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **rspack** - Fast bundler
- **Module Federation** - Micro-frontend runtime
- **Material-UI (MUI)** - Component library
- **GraphQL Mesh** - BFF layer
- **Express.js** - HTTP server

### API Generation Stack

- **Express.js** - REST framework
- **MongoDB** / **SQLite** - Database options
- **OpenAPI** - API specification
- **JWT** - Authentication

### Deployment Stack

- **Docker** - Containerization
- **Kubernetes** - Orchestration
- **docker-compose** - Local development

## Key Architectural Patterns

### 1. DSL-Driven Code Generation

All generated code comes from declarative YAML manifests:

```yaml
name: my-mfe
capabilities:
  - DataAnalysis: { type: domain }
data:
  sources:
    - name: API
      handler:
        openapi:
          source: ./spec.yaml
```

### 2. Template Method Pattern (Runtime)

```typescript
abstract class BaseMFE {
  load() {
    /* common logic */ return this.doLoad();
  }
  protected abstract doLoad(): LoadResult;
}

class RemoteMFE extends BaseMFE {
  protected doLoad() {
    /* specific implementation */
  }
}
```

### 3. Module Federation

- Shell (host) consumes remote MFEs
- Remotes expose components via `remoteEntry.js`
- Shared dependencies (React, MUI) with `singleton: true`

### 4. GraphQL Mesh BFF

- Single GraphQL endpoint
- Merges multiple REST APIs
- Context injection for auth
- Response caching

### 5. Hybrid Orchestration (Design)

- Orchestration service (Docker-only)
- Shell runtime (browser)
- DSL-based discovery

## Package Structure

```
seans-mfe-tool/
├── bin/                    # CLI entry point
├── src/
│   ├── commands/          # CLI command handlers
│   ├── codegen/          # Code generation engine
│   │   ├── UnifiedGenerator/
│   │   ├── APIGenerator/
│   │   └── templates/
│   ├── dsl/              # DSL schema & validation
│   ├── runtime/          # Runtime platform package
│   ├── utils/            # Shared utilities
│   └── agent-orchestrator/ # Future: Dynamic loading
├── dist/
│   └── runtime/          # Compiled runtime package
├── examples/             # Generated project examples
├── docs/                 # Documentation
│   ├── architecture-decisions/
│   ├── requirements/
│   └── acceptance-criteria/
└── scripts/              # Build scripts
```

## Active Development Areas

### ✅ Complete

- CLI commands (remote:generate, api, bff)
- Unified code generator
- Template system
- DSL schema and validation
- Runtime base classes
- Module Federation integration
- BFF generation with GraphQL Mesh
- API generation from OpenAPI

### 🟡 In Progress

- Runtime platform handlers (Issues #47-59)
- Context implementation (REQ-RUNTIME-002)
- Error boundaries and fallback UI

### 📋 Planned

- Agent orchestrator implementation
- Dynamic MFE discovery
- Multi-project workspace management
- Architecture governance agent

## Key Requirements

### Runtime Platform (Active)

- **REQ-RUNTIME-001**: Load capability (atomic operation)
- **REQ-RUNTIME-002**: Shared context (foundation)
- **REQ-RUNTIME-003**: Render capability
- **REQ-RUNTIME-004**: Health checks
- **REQ-RUNTIME-005**: Platform handler registry
- **REQ-RUNTIME-006**: Authentication handler
- **REQ-RUNTIME-009**: Error handling with retry

### BFF Layer

- **REQ-BFF-001**: DSL as single source of truth
- **REQ-BFF-002**: GraphQL Mesh integration
- **REQ-BFF-003**: JWT authentication forwarding
- **REQ-BFF-004**: BFF + static assets same deployable

### Code Generation

- **REQ-REMOTE-001**: Generate from DSL manifest
- **REQ-REMOTE-002**: Feature components from capabilities
- **REQ-REMOTE-003**: Module Federation configuration
- **REQ-REMOTE-004**: Platform code generation

## Architecture Decision Records

Key ADRs shaping the architecture:

- **ADR-009**: Hybrid orchestration (service + runtime)
- **ADR-013**: Language-agnostic DSL
- **ADR-046**: GraphQL Mesh with DSL-embedded config
- **ADR-048**: Unified generator consolidation
- **ADR-059**: Platform handler interface
- **ADR-060**: Load capability atomic operation design
- **ADR-062**: Mesh v0.100.x with createBuiltMeshHTTPHandler

---

**Document Version**: 1.0.0  
**Last Updated**: December 8, 2025  
**Status**: Current State Documentation
