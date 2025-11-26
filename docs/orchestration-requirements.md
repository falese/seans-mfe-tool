# Orchestration Feature - Requirements Elicitation Plan

**Document Status:** Draft - In Progress  
**Created:** 2025-11-26  
**Owner:** Sean  
**Feature:** MFE Orchestration System

---

## Purpose

This document captures requirements for adding orchestration capabilities to the MFE Development Tool. The orchestration feature will manage coordination, lifecycle, and communication between multiple MFE applications (shells, remotes, and APIs).

---

## Requirements Gathering Sessions

### Session 1: Vision & Core Objectives

**Goal:** Understand the high-level vision and primary use cases for orchestration.

**Questions:**

1. What problem does orchestration solve for your MFE development workflow?
2. What are the key scenarios where you need orchestration? (e.g., starting multiple services, coordinating deployments, managing dependencies)
3. Who are the primary users of this feature? (developers, DevOps, both?)
4. What does success look like for this feature?
5. Are there any existing tools or patterns you want to emulate or avoid?

**To Document:**

- [ ] Primary use cases and user stories
- [ ] Success criteria and KPIs
- [ ] Target users and their workflows
- [ ] Constraints and non-goals

---

### Session 2: Scope & Architecture

**Goal:** Define what orchestration encompasses and how it fits into the existing tool.

**Questions:**

1. Which components should orchestration manage? (shells, remotes, APIs, databases, other services?)
2. Should orchestration be:
   - A new CLI command (`mfe orchestrate`)?
   - Part of existing commands (enhanced `deploy`)?
   - A separate daemon/service?
   - Configuration-driven (YAML/JSON)?
3. What lifecycle states need management? (start, stop, restart, health check, scale, update?)
4. Should orchestration support different environments? (development, staging, production)
5. How should it integrate with existing features (build, analyze, deploy)?

**To Document:**

- [ ] Component scope and boundaries
- [ ] CLI command structure
- [ ] Configuration format and schema
- [ ] Integration points with existing commands
- [ ] Environment strategy

---

### Session 3: Configuration & Topology

**Goal:** Define how users describe their MFE architecture and dependencies.

**Questions:**

1. How should users define their MFE topology? (config file, CLI flags, interactive prompts?)
2. What metadata is needed for each service? (name, type, port, dependencies, health endpoints?)
3. How should dependencies between services be expressed?
4. Should there be support for service groups or tags?
5. How do we handle dynamic vs static configuration?
6. Should configuration support templating or variables?

**To Document:**

- [ ] Configuration file format (example structure)
- [ ] Required vs optional fields for each service type
- [ ] Dependency specification syntax
- [ ] Variable/templating system
- [ ] Validation rules

---

### Session 4: Service Management & Lifecycle

**Goal:** Define how orchestration manages service lifecycles.

**Questions:**

1. How should services be started? (sequential, parallel, dependency-ordered?)
2. What startup options are needed? (ports, environment variables, build modes?)
3. How should orchestration handle service failures? (retry, fail-fast, circuit breaker?)
4. What health check mechanisms should be supported?
5. How should services be stopped? (graceful shutdown, timeout, force kill?)
6. Should there be support for service restart/reload without full restart?
7. How should logs be aggregated and displayed?

**To Document:**

- [ ] Startup strategies and ordering
- [ ] Health check specifications
- [ ] Failure handling policies
- [ ] Shutdown procedures
- [ ] Log management approach
- [ ] Process management strategy

---

### Session 5: Development Experience

**Goal:** Ensure orchestration enhances developer productivity.

**Questions:**

1. How should developers interact with orchestration? (CLI commands, config files, UI?)
2. What status/monitoring information is needed during development?
3. Should there be hot reload/watch mode support across services?
4. How should developers debug individual services within orchestration?
5. What commands are needed for day-to-day work? (status, logs, restart single service?)
6. Should there be profiles or presets for common scenarios?

**To Document:**

- [ ] CLI command reference
- [ ] Developer workflows
- [ ] Monitoring and status display
- [ ] Debugging capabilities
- [ ] Common profiles/presets

---

### Session 6: Deployment & Production

**Goal:** Determine production deployment requirements.

**Questions:**

1. Should orchestration support production deployments or just development?
2. If production: Docker Compose, Kubernetes, both, or something else?
3. How does orchestration relate to the existing `deploy` command?
4. What deployment strategies are needed? (rolling, blue-green, canary?)
5. How should environment-specific configuration be handled?
6. What about secrets management?
7. Should there be support for service discovery?

**To Document:**

- [ ] Deployment targets and strategies
- [ ] Production configuration approach
- [ ] Secrets management integration
- [ ] Service discovery mechanisms
- [ ] Relationship to existing deploy command

---

### Session 7: Testing & Quality

**Goal:** Ensure orchestration supports testing workflows.

**Questions:**

1. How should orchestration support integration testing across services?
2. Should there be test-specific configurations or modes?
3. How should test data be managed across services?
4. What about mocking or stubbing remote services?
5. How does orchestration interact with CI/CD pipelines?

**To Document:**

- [ ] Testing strategies and modes
- [ ] Test data management
- [ ] CI/CD integration approach
- [ ] Mock/stub capabilities

---

### Session 8: Advanced Features & Extensions

**Goal:** Identify advanced capabilities and future extensibility.

**Questions:**

1. Should orchestration support service scaling (multiple instances)?
2. What about load balancing or proxying between services?
3. Should there be plugin/extension support for custom orchestrators?
4. How about service templates or blueprints?
5. Should orchestration integrate with monitoring/observability tools?
6. What about inter-service communication patterns (events, queues)?

**To Document:**

- [ ] Scaling capabilities
- [ ] Load balancing/proxy features
- [ ] Plugin architecture
- [ ] Observability integration
- [ ] Communication patterns

---

## Requirements Template

For each requirement identified, document:

```markdown
### REQ-XXX: [Requirement Title]

**Priority:** [Critical | High | Medium | Low]
**Category:** [Core | Configuration | CLI | Deployment | Testing | Advanced]
**Status:** [Proposed | Accepted | Implemented | Deferred]

**Description:**
[Clear description of what is needed]

**Rationale:**
[Why this requirement exists]

**Acceptance Criteria:**

- [ ] Criterion 1
- [ ] Criterion 2

**Dependencies:**
[Other requirements or features this depends on]

**Technical Notes:**
[Implementation considerations, constraints, alternatives]
```

---

## Requirements Catalog

_(To be populated during elicitation sessions)_

### Core Requirements

<!-- Requirements will be added here -->

### Configuration Requirements

<!-- Requirements will be added here -->

### CLI Requirements

<!-- Requirements will be added here -->

### Deployment Requirements

<!-- Requirements will be added here -->

### Testing Requirements

<!-- Requirements will be added here -->

### Advanced Requirements

<!-- Requirements will be added here -->

---

## Decision Log

### Decisions Pending

- [ ] Orchestration approach: new command vs enhanced existing vs daemon
- [ ] Configuration format: YAML vs JSON vs custom DSL
- [ ] Process management: built-in vs pm2/docker-compose wrapper
- [ ] Development vs production scope

### Decisions Made

_(Will be populated as decisions are finalized)_

---

## Next Steps

1. **Schedule Session 1** - Discuss vision and objectives
2. Review and refine this elicitation plan based on Session 1 feedback
3. Proceed through remaining sessions in sequence
4. Document requirements in catalog as they are identified
5. Create architectural design document after requirements are complete
6. Update ENHANCEMENT-PLAN.md with orchestration phase

---

## References

- Project README: `/README.md`
- Enhancement Plan: `/ENHANCEMENT-PLAN.md`
- Architecture Decisions: `/docs/architecture-decisions.md`
- Existing Commands: `shell`, `remote`, `api`, `init`, `deploy`, `build`, `analyze`

---

## Notes & Open Questions

_(Space for capturing ad-hoc thoughts during requirements gathering)_

---

## Session 1: Vision & Core Objectives - RESPONSES

**Date:** 2025-11-26

### Question 1: What problem does orchestration solve for your MFE development workflow?

**Response:**
The orchestration feature aims to enable **dynamic, runtime consumption of MFEs and AI Agents/Tools/Skills as MFEs** through a standardized, declarative approach. Key problems being solved:

1. **Runtime Dynamic Composition**: Move beyond static build-time MFE configuration to allow user or machine-driven selection of which MFEs to load at runtime
2. **Non-Code Integration**: Eliminate the need for developers to write integration code by providing a DSL-based approach for declaring MFE capabilities
3. **Capability Discovery**: Enable MFEs (including AI agents/tools) to advertise their capabilities in a standard way
4. **Development Bottleneck**: Current MFE consumption requires "building in everything" upfront - orchestration should eliminate this constraint
5. **Scale Challenge**: Support dynamic scaling where MFEs can be added/removed without rebuilding the entire application
6. **AI-as-MFE Pattern**: Treat AI agents, tools, and skills as first-class MFEs that can be orchestrated alongside traditional UI components

**Key Insight:** This is about **runtime orchestration** (dynamic loading/composition) not just **development orchestration** (starting services). The code generation and runtime orchestration must be tightly coupled - generation creates MFEs that conform to orchestration contracts.

**Architecture Implications:**

- DSL for capability declaration
- Runtime registry/discovery mechanism
- Dynamic module loading (beyond static Module Federation config)
- Standard contracts for MFE capabilities (especially AI agents/tools)
- User and machine (programmatic) selection mechanisms

---

### Question 2: What are the key scenarios where you need orchestration?

**Response:**
Confirmed all four runtime scenarios are in scope:

1. **User-Driven Selection**: Users select needed capabilities from a menu/catalog at runtime
2. **AI Agent-Driven Composition**: AI agents determine which tools/MFEs they need and load them dynamically
3. **Role-Based Configuration**: Admins configure which MFEs are available for different user roles
4. **Context-Aware Adaptation**: System adapts MFE availability based on context (permissions, environment, usage patterns)

**Concrete Scenarios Needed:**

- Awaiting 2-3 specific user journey examples to illustrate the workflow

**Scenario A - Developer adds new feature:**

- Developer runs `mfe remote my-new-tool --capabilities=...`
- MFE auto-registers with the orchestration layer
- Shell is made aware of new features immediately (no redeploy)
- Available for users to consume dynamically

**Scenario B - AI agent discovers and uses tools (PRIMARY FOCUS):**

- Agent receives a task
- Agent queries orchestration layer: "What MFEs are available?"
- Agent examines MFE DSL declarations to determine capabilities and alignment
- Agent loads appropriate MFE(s)
- Agent invokes MFE functionality
- **Tool usage telemetry reported back through orchestration layer**
- Context about MFE usage is captured and made available
- **This enables self-improvement: tools can build more tools**

**Key Insight:** Scenario B is the **foundation** because:

1. Defines abstract MFE contract that can be implemented in **any language**
2. Enables **language-agnostic** MFE development
3. Creates **self-building capability** - "drinking our own wine"
4. MFEs become tools that can generate more MFEs
5. Orchestration layer becomes the universal integration point

**Scenario C - User customizes workspace:**

- User logs in and sees available MFE/capability catalog
- User selects which to load
- Preferences persisted via user profile
- Defined experiences can be updated

---

### Question 3: MFE Capabilities DSL

**Key Requirements Emerging:**

- DSL must be **language-agnostic** (JSON/YAML based, not code)
- Must describe MFE capabilities in machine-readable format for AI agents
- Must support telemetry/usage reporting back through orchestration
- Should enable abstract base contract that any language can implement

**Proposed DSL Structure** (see `/docs/dsl.yaml`):

Key innovations in the proposed DSL:

1. **Capabilities are first-class with nested inputs/outputs**: Each capability declares its own I/O contract
2. **Lifecycle hooks**: `before`, `main`, `after`, `error` phases for execution pipeline
3. **Handler-based execution**: Each lifecycle step has a named handler function
4. **Authorization at the handler level**: Fine-grained permissions per operation
5. **Required inputs tracked per handler**: Explicit data flow requirements
6. **Module Federation integration**: `remoteEntry` field for MF5 compatibility
7. **Dependency declaration**: Shared dependencies like design systems

**Critical Design Elements:**

- **Capabilities array**: Single MFE can offer multiple capabilities (data-analysis, file-processing, etc.)
- **Nested structure**: capabilities > lifecycle > handlers creates clear execution model
- **Authorization model**: `user.permission.true`, `system.permission.admin` style permissions
- **Language field**: Declares implementation language (javascript, python, go, etc.)
- **Endpoint + remoteEntry**: Supports both REST API and Module Federation loading

**Questions for deeper exploration:**

1. Should capabilities support sub-capabilities or composition?
2. How do we handle async operations in lifecycle?
3. What's the schema format for complex inputs/outputs?
4. How do handlers get discovered/invoked across languages?
5. How does authorization integrate with existing auth systems?
6. Should there be capability discovery/search metadata (tags, categories)?

**Answers - Handler Discovery & Invocation:**

- **Web MFEs**: Use Module Federation to load and invoke functions directly
- **Functions can render UI**: Each handler can return UI components in addition to data
- **Non-web MFEs**: Expose REST/gRPC endpoints that conform to the contract
- **Platform-level DSL**: Define contract that ALL MFEs must conform to (regardless of implementation)
- This creates a **hybrid execution model**: native for web, API for services

**Answers - Authorization:**

- Pattern after **Google Zanzibar tuples** (simple, infinitely scalable)
- Authorization will be a **separate feature** to be defined after orchestration is established
- Authorization system deferred to future work

**Answers - Schema & Telemetry:**

- **Schema format**: JSON Schema for simplicity and broad tooling support
- **Telemetry**: Should be **platform-level DSL** (not MFE-specific)
- Focus on **use case rationalization first**, telemetry details come later

---

### Question 4: Platform-Level DSL Contract

You mentioned "platform level DSL that all MFEs must conform to" - this is critical. What must EVERY MFE provide regardless of type?

Thinking out loud, all MFEs might need:

- Identity (name, version, type)
- Discovery metadata (description, capabilities)
- Health/readiness endpoints
- Registration mechanism
- Standard error responses
- Lifecycle conformance (initialize, execute, cleanup?)

**What are the core contracts that make an MFE "orchestration-ready"?**

---

### Question 5: AI Agent Query & Selection Mechanism

**Response:**
Multi-phase selection strategy - **probabilistic to deterministic progression**:

**Phase A (Probabilistic - Dynamic)**:

- Return ALL MFE DSL documents to the agent
- Agent uses its own reasoning/LLM to evaluate matches
- Most flexible, enables emergent behaviors
- Surfaces dynamic experiences first

**Phase C (Semantic - Assisted)**:

- Agent describes need in natural language
- Orchestration layer returns ranked/scored matches
- Hybrid approach: structured + intelligent

**Phase B (Deterministic - Precise)**:

- Query DSL: `type=tool AND capabilities.includes('data-analysis')`
- Exact filtering, repeatable results
- Most prescriptive, used when precision is required

**Key Insight:** "Go from probabilistic to deterministic" - start with maximum flexibility and agent autonomy, progressively add more structure when needed. This enables **dynamic experiences first**, becoming more **prescriptive** as requirements solidify.

**Implementation Implications:**

- Orchestration layer must support all three query modes
- Phase A is the foundation (simplest: return all DSL)
- Phase C requires semantic indexing/embedding of MFE capabilities
- Phase B requires query language parser and DSL field indexing
- Agent chooses which phase based on task confidence and context

---

### Question 6: Registration & Discovery Flow

**Deferred** - Need to establish orchestration layer architecture first

---

### Question 7: Orchestration Layer Architecture

**Response:**
**Hybrid architecture combining centralized service with distributed runtime:**

**Option B - Centralized Orchestration Service:**
- Separate orchestration service (registry/API)
- Central source of truth for all available MFEs
- Handles registration, discovery, health checks
- Provides query APIs (Phase A/B/C)
- Manages MFE lifecycle state
- Stores DSL documents
- Potentially handles telemetry aggregation

**Option A - Shell Runtime Orchestration:**
- Shell application contains runtime orchestration
- Browser-based registry/cache of available MFEs
- Handles dynamic loading via Module Federation
- Manages local MFE state (loaded, active, etc.)
- Executes MFE invocations
- Renders MFE UI components

**Combined Architecture:**
```
┌─────────────────────────────────────┐
│   Orchestration Service (Option B)  │
│   - Central registry                 │
│   - MFE discovery/health             │
│   - DSL storage                      │
│   - Query API (A/C/B phases)         │
└───────────────┬─────────────────────┘
                │
                │ REST API
                ▼
┌─────────────────────────────────────┐
│   Shell App (Option A)               │
│   - Runtime orchestration            │
│   - Module Federation loading        │
│   - Local MFE execution              │
│   - UI rendering                     │
│   - Cached registry                  │
└─────────────────────────────────────┘
```

**Benefits:**
- **Centralized**: Single source of truth, easier management, cross-shell visibility
- **Distributed runtime**: Performance, offline capability, reduced latency
- **Separation of concerns**: Service manages state, shell manages execution
- **Scalability**: Multiple shells can share one orchestration service

**Key Questions:**
1. Should registration be push (MFE → Service) or pull (Service → MFE)?
2. How does shell sync with orchestration service? (polling, websocket, event-driven?)
3. What happens if orchestration service is unavailable? (cached registry, degraded mode?)
4. Should orchestration service be part of this tool's generated code or separate deploy?
