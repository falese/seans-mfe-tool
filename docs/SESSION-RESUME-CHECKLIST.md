# Orchestration Requirements - Session Resume Checklist

**Date:** 2025-11-26  
**Status:** Sessions 1 & 2 Complete  
**Next:** Ready for Session 3 or Implementation

---

## What's Already Captured ✅

### Core Vision & Objectives (Session 1)
- ✅ Problem statement: Runtime dynamic MFE composition
- ✅ Primary use case: AI agents discovering and invoking MFEs via DSL
- ✅ Success metrics: <5s availability, 100+ MFE scale, zero config, self-documenting, self-building
- ✅ Target users: Developers (V1), AI Agents (V2+)
- ✅ Key scenarios: User-driven (A), AI agent-driven (B - PRIMARY), Role-based (C), Context-aware
- ✅ Discovery strategy: Three phases (A→C→B) - Probabilistic → Semantic → Deterministic
- ✅ Non-goals: Not build tool, not deploy tool (but integrates), not data persistence

### Architecture Decisions (Sessions 1 & 2)
- ✅ ADR-009: Hybrid architecture (centralized service + shell runtime)
- ✅ ADR-010: Lightweight registry (metadata only, DSL endpoints)
- ✅ ADR-011: Three-phase discovery (A/C/B)
- ✅ ADR-012: Push registration on startup/shutdown
- ✅ ADR-013: Language-agnostic DSL (YAML/JSON)
- ✅ ADR-014: Self-building system capability
- ✅ ADR-016: Orchestration service generated per shell
- ✅ ADR-017: Docker-only orchestration, dev servers for MFEs
- ✅ ADR-018: Abstract base class with standard capabilities (authorizeAccess, health, describe, schema, query)
- ✅ ADR-019: JWT-based authorization
- ✅ ADR-020: mfe init for workspace, shell explicit
- ✅ ADR-007: Module Federation loading

### Component Scope (Session 2)
- ✅ IN SCOPE: Shells, Remotes (UI), Tool MFEs, Agent MFEs, API MFEs
- ✅ OUT OF SCOPE: Databases (owned by APIs), Build artifacts (deferred), Static assets/CDN (deferred), Monitoring/logging (deferred), CI/CD (deferred), Starting services (CLI, not orchestration)
- ✅ DEFERRED: Design system strategy, shared dependencies management

### Platform Contract (Session 2)
- ✅ Standard capabilities ALL MFEs must implement:
  - authorizeAccess (JWT validation)
  - health (status check)
  - describe (introspection)
  - schema (GraphQL schema)
  - query (GraphQL query interface)
- ✅ GraphQL-style introspection and querying
- ✅ API data interrogation via DSL methods
- ✅ Abstract base class pattern (works in any language)

### CLI Integration (Session 2)
- ✅ `mfe shell <name>` - generates shell + orchestration service
- ✅ `mfe remote <name>` - generates remote MFE (never orchestration)
- ✅ `mfe init <workspace>` - scaffolds workspace with remotes only
- ✅ `mfe register <mfe>` - shared kernel, validates and registers DSL
- ✅ `mfe validate <mfe>` - DSL validation
- ✅ `mfe registry status` - query orchestration registry
- ✅ Auto-generated registration code in all MFE templates

### Deployment Model (Session 2)
- ✅ Docker Compose for all deployments (dev/staging/prod)
- ✅ Orchestration service always in Docker
- ✅ Shell always in Docker
- ✅ MFEs in dev servers (development) or Docker (staging/prod)
- ✅ Environment-specific configs (docker-compose.yml vs docker-compose.prod.yml)
- ✅ Service discovery via Docker network or localhost

### Requirements Catalog
- ✅ 24 requirements documented (REQ-001 through REQ-024)
- ✅ Priority levels assigned (P0/P1/P2)
- ✅ Dependencies mapped
- ✅ Acceptance criteria defined
- ✅ Technical notes included

---

## Potential Gaps / Areas to Validate 🔍

### Technical Implementation Details

**1. Orchestration Service Technology Stack**
- ❓ Language choice: Node.js? Go? Python?
- ❓ Framework: Express? Fastify? Koa?
- ❓ Registry storage: Redis? PostgreSQL? In-memory?
- ❓ Recommendation: **Node.js + Fastify + Redis** (consistency with ecosystem)

**2. DSL Schema Specification**
- ✅ Reference DSL in `/docs/dsl.yaml`
- ❓ JSON Schema for validation - needs formal definition
- ❓ Platform-level schema vs MFE-specific schema separation
- ❓ Versioning strategy for DSL evolution

**3. Module Federation Configuration**
- ❓ Shared dependency strategy for 100+ MFEs
- ❓ Version conflict resolution
- ❓ Design system distribution approach
- ❓ Bundle size optimization strategies
- ⚠️ **Explicitly deferred** but needs eventual solution

**4. WebSocket Protocol**
- ❓ Message format for registry updates
- ❓ Reconnection strategy
- ❓ Heartbeat/keepalive mechanism
- ❓ Authentication for WebSocket connections

**5. Health Check Specification**
- ❓ Health check interval (30s mentioned)
- ❓ Timeout before marking unhealthy
- ❓ Circuit breaker pattern details
- ❓ Recovery/retry logic

**6. Error Handling & Resilience**
- ❓ What happens when orchestration service is down?
- ❓ Fallback modes for shell runtime
- ❓ MFE loading failure handling
- ❓ Partial system degradation strategy

**7. Security Model**
- ✅ JWT-based authorization defined
- ❓ Token refresh mechanism
- ❓ Service-to-service authentication (agent tokens)
- ❓ Rate limiting on orchestration API
- ❓ CORS configuration for cross-origin MFEs
- ⚠️ Zanzibar tuples **explicitly deferred** to future

**8. Telemetry & Observability**
- ⚠️ **Explicitly deferred** to V2
- ❓ What minimal telemetry needed for V1?
- ❓ Error tracking/logging approach
- ❓ Performance monitoring basics

**9. Testing Strategy**
- ❓ How to test orchestration locally?
- ❓ Integration test approach for multi-MFE scenarios
- ❓ Mock orchestration service for MFE unit tests
- ❓ CI/CD testing strategy

**10. Migration & Backwards Compatibility**
- ❓ How do existing MFEs adopt orchestration?
- ❓ Can MFEs work without orchestration?
- ❓ Gradual rollout strategy
- ❓ Versioning and deprecation policy

---

## Session 3 Prep: Technical Specifications

Based on your progress, Session 3 should focus on:

### Session 3A: Orchestration Service Specification
**Questions to answer:**
1. **Service Implementation**
   - Technology stack decision (Node.js + Fastify recommended)
   - Registry storage choice (Redis for prod, in-memory for dev)
   - REST API endpoint design
   - WebSocket protocol specification

2. **Registry Schema**
   - Exact data structure for MFE registry entries
   - Index structures for discovery queries
   - Health status state machine
   - Update/versioning strategy

3. **API Contract**
   - POST /api/mfes/register - registration payload
   - DELETE /api/mfes/:name - deregistration
   - GET /api/mfes - Phase A discovery (list all)
   - GET /api/mfes/:name/dsl - fetch full DSL
   - WS /ws - WebSocket protocol
   - GET /health - service health

4. **Configuration**
   - Environment variables
   - Redis connection settings
   - Health check intervals
   - WebSocket settings

### Session 3B: DSL Schema Formalization
**Questions to answer:**
1. **JSON Schema Definition**
   - Platform-level required fields
   - MFE-specific optional fields
   - Validation rules
   - Examples for each MFE type

2. **Capability Schema**
   - Input/output specifications
   - Handler definitions
   - Lifecycle phases
   - Authorization requirements

3. **GraphQL Schema Standards**
   - Query interface contract
   - Mutation interface contract
   - Type system conventions
   - Introspection format

### Session 3C: Shell Runtime Specification
**Questions to answer:**
1. **Runtime Architecture**
   - Registry cache implementation
   - Module Federation loader
   - WebSocket client
   - Discovery client API

2. **MFE Lifecycle**
   - Initialize phase
   - Execute phase
   - Cleanup phase
   - Error handling

3. **UI Integration**
   - How shell loads remote UI components
   - Routing integration
   - State management across MFEs
   - Error boundaries

---

## What You Should Do Before Next Session

### Option A: Continue Requirements Gathering
If you want to complete requirements before implementation:

**Next:** Schedule Session 3 (Technical Specifications)
- Focus: Orchestration service API design
- Focus: DSL JSON Schema definition
- Focus: Shell runtime architecture
- Duration: ~1 hour

Then: Session 4 (Implementation Planning)
- Break down into implementation tasks
- Define milestones
- Create POC/MVP scope
- Identify first iteration

### Option B: Start Implementation POC
If you want to validate with code:

**Next:** Build minimal orchestration POC
1. Generate orchestration service (Node.js + Fastify + in-memory registry)
2. Update shell generator to include orchestration service
3. Update remote generator with auto-registration code
4. Test: Generate shell + 2 remotes, validate registration
5. Measure: <5s availability, zero config validation

Then: Use POC learnings to refine requirements

### Option C: Hybrid Approach (Recommended)
**Next:** Parallel track
1. **Design track:** Complete Session 3 specs (1-2 hours)
2. **Code track:** Start orchestration service POC (parallel)
3. **Validate:** Use POC to test assumptions from Session 3
4. **Iterate:** Refine specs based on POC learnings

---

## Key Questions to Resolve

Before implementation, these decisions would be helpful:

1. **Technology Stack**
   - Orchestration service language/framework
   - Registry storage (Redis vs PostgreSQL vs in-memory)
   - WebSocket library

2. **Scope for V1**
   - Which requirements are MVP vs V2?
   - Phase A only, or A+C+B?
   - Basic auth only, or full JWT?
   - In-memory registry only, or Redis?

3. **Testing Strategy**
   - How to test locally?
   - Integration test approach?
   - CI/CD strategy?

4. **Migration Path**
   - Existing MFEs without orchestration?
   - Gradual adoption strategy?
   - Backwards compatibility?

---

## Next Steps Recommendations

**Immediate (Today/Tomorrow):**
1. ✅ Review this checklist - confirm nothing major missing
2. ⏭️ Make technology stack decisions (see recommendations above)
3. ⏭️ Define V1 MVP scope clearly (which REQs are must-have?)

**Short-term (This Week):**
4. ⏭️ Session 3: Technical Specifications (1-2 hours)
5. ⏭️ Start orchestration service POC
6. ⏭️ Generate and test basic registration flow

**Medium-term (Next 1-2 Weeks):**
7. ⏭️ Complete orchestration service implementation
8. ⏭️ Update shell/remote generators
9. ⏭️ Build self-building validation (tool generates tool)
10. ⏭️ Documentation and examples

---

## Resume Prompt for Next Session

When you're ready to continue:

```
I'm ready to continue orchestration design. We've completed:
- Session 1: Vision & Core Objectives ✅
- Session 2: Scope & Architecture ✅

We have:
- 24 requirements documented (REQ-001 to REQ-024)
- 21 ADRs recorded (ADR-001 to ADR-021)
- Architecture decisions made
- Component scope defined

Next options:
A) Session 3: Technical Specifications
B) Start implementation POC
C) Hybrid: Specs + POC in parallel

Which path should we take?
```

---

## Documentation Files

All content captured in:
- `/docs/orchestration-requirements.md` (2517 lines)
- `/docs/architecture-decisions.md` (1972 lines)
- `/docs/dsl.yaml` (reference DSL)
- `/docs/SESSION-2-SUMMARY.md`
- `/docs/SESSION-RESUME-CHECKLIST.md` (this file)

**Status:** Ready to proceed ✨
