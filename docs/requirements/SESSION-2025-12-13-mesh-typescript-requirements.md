# Requirements Elicitation Session Summary: Mesh TypeScript Configuration

**Session Date**: 2025-12-13  
**Duration**: Comprehensive requirements gathering  
**Mode**: Requirements Elicitation Agent  
**Status**: ✅ Complete - Ready for Implementation

---

## 📋 Session Overview

Successfully conducted requirements elicitation for migrating BFF layer from YAML-based GraphQL Mesh v0 to TypeScript-based configuration with platform schema mapping capabilities.

### Key Outcomes

1. **✅ User Requirements Captured**: All questions answered, decisions validated
2. **✅ Requirements Document Created**: `docs/requirements/mesh-typescript-config-requirements.md`
3. **✅ Architecture Decisions Documented**: `docs/architecture-decisions/ADR-063-mesh-typescript-config.md`
4. **✅ Refactor Analysis Complete**: `docs/bff-refactor-analysis.md`
5. **✅ Implementation Roadmap**: 6 milestones, 13-day timeline

---

## 🎯 Strategic Decisions Made

### Core Architectural Choices

| Decision                     | Rationale                                       | Impact   |
| ---------------------------- | ----------------------------------------------- | -------- |
| **TypeScript Config**        | Type safety + DSL alignment > YAML flexibility  | High     |
| **Micro-Graph Architecture** | Each BFF independent, no gateway pattern        | Critical |
| **Platform Types Library**   | Shared interfaces for cross-cutting concerns    | High     |
| **DSL Mapping Extension**    | `capabilities[].dataMapping` for schema mapping | High     |
| **Watch Mode Development**   | Continuous regeneration during development      | Medium   |
| **Stay on Mesh v0**          | Avoid gateway dependency, proven stability      | High     |

### User-Validated Principles

1. **DSL is Source of Truth** - Preserve DSL-first architecture using Guild tools
2. **No Gateway Pattern** - Each BFF serves only its MFE's schema
3. **Dynamic Supergraph** - Orchestration layer handles composition at runtime
4. **Type Mapping** - MFEs define mappings, all adhere to platform types
5. **Generated Code** - Always generated, never hand-written

---

## 📄 Documents Created

### 1. Requirements Document

**File**: `docs/requirements/mesh-typescript-config-requirements.md`  
**Status**: 📋 Planned  
**Content**:

- Executive Summary with key principles
- Problem statement and strategic goals
- 7 detailed requirements (REQ-MESH-TS-001 to REQ-MESH-TS-007)
- Implementation plan with 6 milestones
- Success criteria and risk management
- Open questions and related documentation

**Key Requirements**:

- **REQ-MESH-TS-001**: DSL → TypeScript Config Generation
- **REQ-MESH-TS-002**: Programmatic Runtime Mesh
- **REQ-MESH-PLATFORM-002**: Platform Type Library
- **REQ-MESH-PLATFORM-003**: DSL Schema Mapping
- **REQ-MESH-CODEGEN-004**: Mapping Code Generation
- **REQ-MESH-DEPS-005**: Dependency Matrix Testing
- **REQ-MESH-WATCH-006**: Watch Mode Development

---

### 2. Architecture Decision Record

**File**: `docs/architecture-decisions/ADR-063-mesh-typescript-config.md`  
**Status**: 📋 Proposed  
**Decision**: Generate TypeScript `mesh.config.ts` from DSL while using Mesh v0 programmatic runtime API

**Key Decisions**:

1. TypeScript config for type safety (not Mesh v1 migration)
2. Programmatic runtime API (no Hive Gateway)
3. Platform types in shared library (orchestration-owned)
4. Micro-graph architecture (no federation)

**Trade-offs**:

- ✅ Type safety, developer experience, architectural alignment
- ⚠️ Custom tooling, maintenance complexity
- 🔶 Mesh v1 migration deferred, types versioning required

---

### 3. Refactor Analysis

**File**: `docs/bff-refactor-analysis.md`  
**Status**: ✅ Complete  
**Purpose**: Pre-implementation analysis to avoid "slop"

**Key Findings**:

- **65% code reuse** - Most current implementation is solid
- **60% of commands** can be refactored, not rewritten
- **70% of templates** work with minimal changes
- **Effort**: ~95 hours (~12 days) with testing

**Files to Update**:

- `src/commands/bff.ts` - Refactor 4 functions, keep 3
- `src/codegen/templates/bff/server.ts.ejs` - Use programmatic API
- `src/codegen/templates/bff/package.json.ejs` - Update dependencies

**New Files Needed**:

- `mesh.config.ts.ejs` - TypeScript Mesh config template
- `ResolverGenerator.ts` - Platform mapping code generation
- `resolver.template.ts.ejs` - Resolver boilerplate

---

## 🗺️ Implementation Roadmap

### Milestone 1: Foundation (Days 1-3)

**Goal**: Analyze current implementation, validate dependencies

**Deliverables**:

- ✅ Refactor analysis (complete)
- Dependency testing script
- Dependency version matrix documented

---

### Milestone 2: TypeScript Config Generation (Days 4-6)

**Goal**: Generate `mesh.config.ts` from DSL

**Tasks**:

- Update `bff:generate-config` command
- Create TypeScript config template
- Map DSL to TypeScript API
- Add validation

**Deliverables**:

- `src/commands/bff-generate-config.ts`
- `mesh.config.ts.ejs` template
- Unit tests

---

### Milestone 3: Platform Types Library (Days 7-8)

**Goal**: Create shared type package

**Tasks**:

- Initialize `@mfe-platform/types` package
- Define interfaces (search, task, notification, user)
- Set up TypeScript build
- Publish to local registry/Git

**Deliverables**:

- `@mfe-platform/types@1.0.0` package
- Documentation

---

### Milestone 4: DSL Mapping Extension (Days 9-11)

**Goal**: Support `capabilities[].dataMapping` in DSL

**Tasks**:

- Extend DSL parser
- Validate mapping fields
- Generate resolver code
- Integrate lifecycle hooks

**Deliverables**:

- Updated DSL parser
- `ResolverGenerator.ts`
- Resolver templates
- Unit tests

---

### Milestone 5: Watch Mode Integration (Days 12-13)

**Goal**: Continuous regeneration during development

**Tasks**:

- Add file watching to `bff:dev`
- Implement debounced regeneration
- Graceful server restart
- Error handling

**Deliverables**:

- Watch mode in `bff:dev --watch`
- Example MFE with watch mode

---

### Milestone 6: Integration & Documentation (Days 14-15)

**Goal**: End-to-end testing and documentation

**Tasks**:

- Create full example MFE
- End-to-end testing
- Update documentation
- Migration guide

**Deliverables**:

- Example MFE with platform mapping
- Complete documentation
- ADRs finalized

---

## 🔑 Key Technical Insights

### 1. Dependency Strategy

**Current (Mesh v0 + YAML)**:

```json
{
  "@graphql-mesh/cli": "^0.100.21",
  "@graphql-mesh/openapi": "^0.109.26",
  "@graphql-mesh/serve-runtime": "^1.2.4"
}
```

**Proposed (Mesh v0 + TypeScript)**:

```json
{
  "@graphql-mesh/runtime": "^0.100.21",
  "@graphql-mesh/compose-cli": "^0.5.x",
  "@omnigraph/openapi": "^0.4.x",
  "@mfe-platform/types": "^1.0.0"
}
```

**Migration**: Incremental testing, Phase 1: additive, Phase 2: swap, Phase 3: remove

---

### 2. DSL Extension Example

```yaml
# mfe-manifest.yaml
capabilities:
  - search:
      type: domain
      implements: IPlatformSearchResult
      dataMapping:
        source: data.sources[0] # References UserAPI
        query: users
        fields:
          id: user.id
          title: user.name
          description: "user.role + ' - ' + user.department"
          url: "'/users/' + user.id"
          metadata:
            userId: user.id
            email: user.email

data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
```

**Generated TypeScript**:

```typescript
import { IPlatformSearchResult } from '@mfe-platform/types';

export class UserSearchResolver {
  async search(query: string): Promise<IPlatformSearchResult[]> {
    const users = await UserAPI.Query.users({ name: query });
    return users.map((user) => ({
      id: user.id,
      title: user.name,
      description: `${user.role} - ${user.department}`,
      url: `/users/${user.id}`,
      metadata: { userId: user.id, email: user.email },
    }));
  }
}
```

---

### 3. Micro-Graph Architecture

```
┌─────────────────────────────────────┐
│   Orchestration / Control Layer    │
│   (Dynamic Supergraph at Runtime)   │
└─────────────────────────────────────┘
              ↓ Discovers
┌──────────────────────────────────────┐
│  MFE 1: User Dashboard               │
│  ├── BFF (Micro-Graph)               │
│  │   └── GraphQL: Query.users        │
│  └── Remote (React)                  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  MFE 2: Product Catalog              │
│  ├── BFF (Micro-Graph)               │
│  │   └── GraphQL: Query.products     │
│  └── Remote (React)                  │
└──────────────────────────────────────┘
```

**Key**: No static gateway, orchestration composes at runtime

---

## ⚠️ Critical Constraints & Risks

### Constraints Validated

1. ✅ **DSL as Source of Truth** - Preserved via code generation
2. ✅ **No Gateway Pattern** - Each BFF independent
3. ✅ **Type Safety** - TypeScript throughout
4. ✅ **Shell Never Dictates** - Orchestration layer owns interfaces
5. ✅ **No Custom Functions** - Keep mapping expressions simple

### Top Risks

| Risk                     | Likelihood | Impact   | Mitigation                             |
| ------------------------ | ---------- | -------- | -------------------------------------- |
| Dependency Hell          | High       | Critical | Incremental testing, exact versions    |
| Mesh API Changes         | Medium     | High     | Pin versions, monitor changelog        |
| Code Gen Complexity      | Medium     | Medium   | Start simple, extensive tests          |
| Platform Type Versioning | Medium     | Medium   | Semantic versioning, migration scripts |

---

## 📊 Success Metrics

### Quantitative

- [ ] 100% type safety (strict TypeScript)
- [ ] 0 dependency errors (clean npm install)
- [ ] < 500ms regeneration time (watch mode)
- [ ] 100% test coverage (new code)
- [ ] 4 platform types (search, task, notification, user)

### Qualitative

- [ ] Responsive watch mode experience
- [ ] Clear error messages with DSL context
- [ ] Complete documentation and examples
- [ ] Maintainable, understandable code
- [ ] Fits micro-graph + orchestration vision

---

## 🚀 Next Steps

### Immediate Actions (Next 1-2 Days)

1. **Review Documents**

   - [ ] Read requirements document thoroughly
   - [ ] Validate ADR decisions align with vision
   - [ ] Confirm refactor analysis makes sense

2. **Create GitHub Issues**

   - [ ] Milestone 1: Foundation
   - [ ] Milestone 2: TypeScript Config
   - [ ] Milestone 3: Platform Types
   - [ ] Milestone 4: DSL Mapping
   - [ ] Milestone 5: Watch Mode
   - [ ] Milestone 6: Integration

3. **Set Up Testing Environment**
   - [ ] Create test workspace for dependency validation
   - [ ] Install proposed packages, test compatibility
   - [ ] Document any conflicts or issues

### Short-Term (Next Week)

1. **Milestone 1 Execution**

   - [ ] Complete dependency matrix testing
   - [ ] Validate all package versions work together
   - [ ] Document compatible version set

2. **Begin Milestone 2**
   - [ ] Create `mesh.config.ts.ejs` template
   - [ ] Implement `generateMeshConfigTS()` function
   - [ ] Write unit tests for generation

### Medium-Term (Next 2 Weeks)

1. **Complete Milestones 2-4**

   - [ ] TypeScript config generation working
   - [ ] Platform types package published
   - [ ] DSL mapping parser complete

2. **Checkpoint Review**
   - [ ] Demo generated code
   - [ ] Validate approach still aligned
   - [ ] Adjust timeline if needed

---

## 📚 Documentation Index

All documentation is now located in the repository:

1. **Requirements**: `docs/requirements/mesh-typescript-config-requirements.md`
2. **ADR**: `docs/architecture-decisions/ADR-063-mesh-typescript-config.md`
3. **Analysis**: `docs/bff-refactor-analysis.md`
4. **Summary**: This document (for reference)

### Related Documentation

- **Current BFF Requirements**: `docs/requirements/graphql-bff-requirements.md`
- **DSL Contract**: `docs/DSL/dsl.yaml`
- **Runtime Requirements**: `docs/runtime-requirements.md`
- **Mesh Research**: `MESH-PLUGINS-RESEARCH.md`, `MESHRC-DIAGNOSIS.md`

---

## 🎓 Lessons Learned from Session

### What Worked Well

1. **Progressive Questioning** - Started broad, narrowed to specifics
2. **Concrete Examples** - DSL snippets and code samples clarified intent
3. **User Validation** - Direct answers prevented assumptions
4. **Trade-off Analysis** - Option comparison helped decision-making
5. **Architecture Diagrams** - Visual representations aligned understanding

### Key Insights Gained

1. **Micro-Graph is Core** - Gateway pattern fundamentally wrong for this architecture
2. **Orchestration Owns Types** - Shell is just a container, not the authority
3. **Simple Mappings Only** - Custom functions rejected as "slippery slope"
4. **Watch Mode Crucial** - Developer experience priority
5. **Pre-Release Flexibility** - Breaking changes acceptable, but analyze first
6. **Hybrid v0/v1 Approach** - TypeScript config (v1 style) + v0 runtime (no gateway)
7. **Track Generated Code** - Git tracking enables reviews, debugging, and CI simplicity

### Questions That Clarified Most

- **Q3 (Option B)**: Eliminated gateway pattern entirely
- **Q4**: Confirmed micro-graph architecture
- **Q7 (Option C)**: Resolved type system duality
- **Q10**: Set migration strategy (refactor, not rewrite)
- **Phase 6**: Clarified orchestration vs. shell role

---

## ✅ Session Completion Checklist

- [x] Problem understanding captured
- [x] Strategic goals validated
- [x] Architecture decisions documented
- [x] Requirements written (7 REQs)
- [x] ADR created (ADR-063)
- [x] Refactor analysis complete
- [x] Implementation roadmap defined
- [x] Risk management documented
- [x] Success criteria established
- [x] Next steps identified

---

## 🔮 Future Considerations

### Not In Scope (But Noted)

1. **GraphQL Subscriptions** - REST-only for v1
2. **Schema Stitching** - Future orchestration feature
3. **Custom Mesh Plugins** - Use built-in only
4. **Multi-Language Support** - JavaScript/TypeScript only
5. **Mesh v1 Migration** - Deferred indefinitely

### Open Questions for Later

1. **Platform Types Distribution** - npm vs. Git vs. monorepo?
2. **Mapping Expression Language** - Simple strings vs. templates?
3. **Orchestration Composition** - How will micro-graphs unite?
4. **Federation Future** - When (if ever) federate?

---

## 📝 Approval

**Requirements Elicitation**: ✅ Complete  
**User Validation**: ✅ All questions answered  
**Documentation**: ✅ Created and comprehensive  
**Ready for Implementation**: ✅ Yes

**Session Artifacts**:

- Requirements document (40 pages)
- Architecture decision (ADR-063)
- Refactor analysis (25 pages)
- This summary document

**Total Documentation**: ~70 pages of comprehensive specifications

---

**End of Session Summary**

_Implementation can begin immediately following document review and GitHub issue creation._
