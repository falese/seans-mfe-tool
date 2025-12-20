# Session 2: Scope & Architecture - Summary

**Date:** 2025-11-26  
**Status Complete:** 

## Key Decisions

### Architecture Separation

**Three distinct layers:**
1. **CLI/CodeGen** - Development tooling (generate, build, validate)
2. **Orchestration Service** - Runtime registry and discovery (embedded in shell)
3. **Shared Kernel** - DSL validation and common types

### Orchestration Service Generated in Every Shell

- `mfe shell <name>` generates shell + orchestration-service/
- Docker Compose deploys both as single unit
- Natural ownership model: shell owns its orchestration
- Elegant deployment: `docker-compose up`

### Docker-Only Orchestration, Dev Servers for MFEs

- **Orchestration**: Always in Docker (dev, staging, prod)
- **Shell**: Always in Docker (dev, staging, prod)
- **MFEs**: Dev servers in development (hot reload), Docker in staging/prod
- Consistent infrastructure, fast development

### Abstract MFE Base Class

- All MFEs (UI/Tool/Agent/API) implement same interface
- Standard capabilities: authorizeAccess, health, describe, schema, query
- GraphQL-style introspection
- Works across all languages (TypeScript, Python, Go)

### JWT-Based Authorization

- JWT tokens for all MFE access
- authorizeAccess standard capability
- Supports users and agents
- Permission convention: `mfe.<name>.<action>`

### mfe init Workspace-First

- `mfe init <workspace>` - workspace only
- `mfe shell <name>` - explicit shell creation
- Flexibility: 0, 1, or many shells per workspace
- Supports monorepo and polyrepo

## New ADRs Created

- **ADR-016**: Orchestration service per shell
- **ADR-017**: Docker-only orchestration, dev servers for MFEs
- **ADR-018**: Abstract MFE base class with standard capabilities
- **ADR-019**: JWT-based authorization for all MFE access
- **ADR-020**: mfe init for workspace, shell explicit

## Requirements Defined

**24 Requirements total:**
- 14 P0 (Critical) - V1 MVP
- 7 P1 (High) - V1 or Early V2
- 3 P2 (Medium) - V2+

**Categories:**
- Core Orchestration: REQ-001, REQ-002, REQ-003, REQ-007, REQ-014
- Platform Contract: REQ-004, REQ-015, REQ-017, REQ-018, REQ-021
- Developer Tooling: REQ-008, REQ-009, REQ-022
- Deployment: REQ-016, REQ-019, REQ-023
- Runtime Integration: REQ-005
- Developer Experience: REQ-006, REQ-020
- Operations: REQ-013
- Security: REQ-017
- System Capability: REQ-012

## Architecture Diagrams

### Development Workflow
```

  Docker Compose                     
     
 shell:   3000                    
     
     
 orchestration-service:   3100    
     
     
 redis:   6379                    
     

               
 Register via HTTP               
               
ls
                                  
Dev Server  Dev Server  Dev Server  Dev Server
feature-a   feature-b   tool-x      api-y
:3001       :3002       :3003       :3004
(npm run dev with hot reload)
```

### Shell Structure
```
my-shell/
 src/                           # Shell application (React)
 App.tsx   
 orchestration-runtime/     # Browser-side orchestration   
 registry-cache.ts      
 mfe-loader.ts          # Module Federation      
 discovery.ts           # Phase A/C/B      
 websocket-client.ts      
 ...   
 orchestration-service/         # Backend service (Node.js)
 server.ts                  # Express/Fastify   
 registry/   
 storage.ts             # Redis/Memory      
 sync.ts      
 api/   
 register.ts            # POST /api/register      
 discover.ts            # GET /api/mfes      
 query.ts               # Phase A/C/B endpoints      
 websocket/   
 broadcast.ts           # Real-time sync       
 docker-compose.yml             # Dev environment
 docker-compose.prod.yml        # Prod overrides
 Dockerfile.shell
 Dockerfile.orchestration
```

### Platform Contract (Standard Capabilities)
```yaml
standardCapabilities:
  - authorizeAccess:     # JWT validation
      handler: checkAuthorization
      inputs: [token, context]
      outputs: [authorized, permissions]
  
  - health:              # Health check
      handler: checkHealth
      outputs: [status, details]
  
  - describe:            # Self-description
      handler: describeSelf
      outputs: [dsl, runtime]
  
  - schema:              # GraphQL introspection
      handler: introspectSchema
      outputs: [schema]
  
  - query:               # GraphQL execution
      handler: executeQuery
      inputs: [token, query, variables]
      outputs: [data, errors]
```

## CLI Commands

```bash
# Workspace setup
mfe init my-project                    # Create workspace

# Shell creation (includes orchestration)
mfe shell apps/main-app                # Generate shell + orchestration

# Remote creation
mfe remote packages/feature-a          # Generate remote

# Validation
mfe validate feature-a                 # Validate DSL

# Registration
mfe register feature-a                 # Register with orchestration

# Build & Deploy
mfe build                              # Build shell + orchestration
docker-compose up                      # Deploy everything

# Development
docker-compose up -d                   # Start shell + orchestration
cd ../feature-a && npm run dev         # Start MFE (registers automatically)

# Status
mfe registry status                    # View registry state
mfe analyze                            # Analyze MFE dependencies
```

## Key Patterns

### Abstract Base Class (TypeScript)
```typescript
abstract class BaseMFE {
  abstract async authorizeAccess(token: JWT): Promise<AuthResult>;
  abstract async checkHealth(): Promise<HealthStatus>;
  abstract async describeSelf(): Promise<DSLDocument>;
  abstract async introspectSchema(): Promise<GraphQLSchema>;
  abstract async executeQuery(token: JWT, query: string): Promise<QueryResult>;
}
```

### Auto-Registration
```typescript
// Generated in every MFE
export async function registerMFE() {
  const orchestrationUrl = process.env.ORCHESTRATION_URL || 'http://localhost:3100';
  
  await fetch(`${orchestrationUrl}/api/register`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'feature-a',
      endpoint: 'http://localhost:3001',
      remoteEntry: 'http://localhost:3001/remoteEntry.js',
      dslEndpoint: 'http://localhost:3001/.well-known/mfe-manifest.yaml'
    })
  });
}
```

### Docker Compose Pattern
```yaml
services:
  orchestration-service:
    build: ./orchestration-service
    ports: ["3100:3100"]
    depends_on: [redis]
  
  shell:
    build: .
    ports: ["3000:3000"]
    environment:
      - ORCHESTRATION_URL=http://orchestration-service:3100
    depends_on: [orchestration-service]
  
  redis:
    image: redis:alpine
```

## Next Steps

**Option A: Continue with Session 3** - Configuration & Topology
- DSL specification details
- Module Federation configuration
- Dependency management

**Option B: Begin Implementation**
- Start with orchestration service generation
- Implement abstract base class
- Build first CLI command

**Option C: Create Prototype**
- Minimal proof-of-concept
- Validate core assumptions
- Test with 2-3 MFEs

## Documentation Updated

1 **orchestration-requirements.md**. 
   - Session 2 complete with all responses
   - 24 requirements defined (REQ-001 through REQ-024)
   - Requirements traceability matrix
   - ADR cross-reference

2 **architecture-decisions.md**. 
   - 5 new ADRs (ADR-016 through ADR-020)
   - Complete ADR set (Session 1 + Session 2)
   - Reference patterns for implementation
   - Code examples in TypeScript and Python

3 **SESSION-2-SUMMARY.md** (this document). 
   - Executive summary
   - Key decisions and diagrams
   - CLI command reference
   - Implementation patterns

## Success Criteria (from Session 1)

These remain our V1 acceptance criteria:

1 **Speed**: Developer generates new MFE, available to agents < 5 seconds. 
2 **Scale**: Agent discovers/uses 100+ MFEs without degradation. 
3 **Zero config**: No manual configuration needed. 
4 **Self-documenting**: DSL is the documentation. 
5 **Self-building**: Tools generate tools ("drinking our own wine"). 

All architectural decisions in Session 2 support these criteria.
