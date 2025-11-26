# Architecture Decision Records (ADRs)

These ADRs guide implementation decisions. Reference them in comments when implementing to help Copilot follow the right patterns.

## ADR-001: Use Map-Based Registry for Agent Storage

**Status:** Accepted

**Context:**
Need to store registered agents and look them up by ID frequently during capability routing and event handling.

**Decision:**
Use `Map<string, AgentRegistryEntry>` for the agent registry.

**Rationale:**

- O(1) lookup by agent ID
- Preserves insertion order (useful for debugging)
- Native TypeScript support with strong typing
- Built-in methods (has, delete, size) match our needs
- Better than object literal (no prototype pollution)
- Better than array (O(n) lookups)

**Implementation Pattern:**

```typescript
// Use Map for agent registry with O(1) lookups
// Key: agent ID string, Value: AgentRegistryEntry with agent instance and metadata
private registry: Map<string, AgentRegistryEntry> = new Map();

// Lookup: O(1)
const entry = this.registry.get(agentId);

// Add: O(1)
this.registry.set(agent.id, entry);

// Check exists: O(1)
if (this.registry.has(agentId)) { }
```

**Reference in comments:** "Following ADR-001: Use Map for agent registry"

---

## ADR-002: Capability Index with Map of Sets

**Status:** Accepted

**Context:**
Multiple agents can provide the same capability. Need fast lookup: "which agents provide capability X?"

**Decision:**
Use `Map<string, Set<string>>` where key is capability name and value is Set of agent IDs.

**Rationale:**

- O(1) lookup by capability name
- Set ensures no duplicate agent registrations for same capability
- Easy to add/remove agents from capability
- Simple to find all agents for a capability
- Memory efficient for typical agent counts

**Implementation Pattern:**

```typescript
// Map of capability name to Set of agent IDs that provide it
// Allows fast "find agents by capability" queries
private capabilityIndex: Map<string, Set<string>> = new Map();

// Add agent to capability:
if (!this.capabilityIndex.has(capabilityName)) {
  this.capabilityIndex.set(capabilityName, new Set());
}
this.capabilityIndex.get(capabilityName)!.add(agentId);

// Find agents:
const agentIds = this.capabilityIndex.get(capabilityName) || new Set();
```

**Reference in comments:** "Following ADR-002: Map of Sets for capability index"

---

## ADR-003: Event Bus with Pattern Matching

**Status:** Accepted

**Context:**
Agents need to subscribe to specific events and also patterns like "all agent lifecycle events".

**Decision:**
Support both exact event type matching and wildcard patterns (e.g., `agent.*`).

**Rationale:**

- Exact matching for specific events (efficient)
- Pattern matching for related event groups (convenient)
- Separate storage prevents pattern overhead on exact matches
- Common in messaging systems (MQTT, RabbitMQ)

**Implementation Pattern:**

```typescript
// Two separate subscription stores
private subscriptions: Map<string, Map<string, EventHandler>> = new Map(); // exact
private patternSubscriptions: Map<string, Map<string, EventHandler>> = new Map(); // patterns

// Pattern matching: convert 'agent.*' to regex /^agent\..*/
private matchesPattern(eventType: string, pattern: string): boolean {
  const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`).test(eventType);
}
```

**Reference in comments:** "Following ADR-003: Support pattern matching in event subscriptions"

---

## ADR-004: Agent State Machine

**Status:** Accepted

**Context:**
Agents go through lifecycle states. Need to prevent invalid operations based on state.

**Decision:**
Use explicit `AgentState` type with these states:

- `loading` - Module is being fetched
- `initializing` - `initialize()` is running
- `ready` - Agent is active
- `suspended` - Agent is paused
- `error` - Agent encountered error
- `unregistering` - Cleanup in progress

**Rationale:**

- Explicit states make valid transitions clear
- Prevents operations in wrong state (e.g., execute during initialization)
- Helps with debugging (can see where agent is stuck)
- Enables filtering (e.g., only execute on 'ready' agents)

**State Transitions:**

```
loading -> initializing -> ready
ready -> suspended -> ready
ready -> error
ready -> unregistering -> [removed]
any -> error
```

**Implementation Pattern:**

```typescript
// Validate state before operations
private validateReadyState(agentId: string): void {
  const entry = this.registry.get(agentId);
  if (!entry) throw new AgentNotFoundError(agentId);
  if (entry.state !== 'ready') {
    throw new InvalidStateError(agentId, entry.state, 'ready');
  }
}

// Update state with event
private updateState(agentId: string, newState: AgentState): void {
  const entry = this.registry.get(agentId)!;
  const previousState = entry.state;
  entry.state = newState;

  this.eventBus.publish({
    type: SystemEventTypes.AGENT_STATE_CHANGED,
    payload: { agentId, previousState, newState }
  });
}
```

**Reference in comments:** "Following ADR-004: Validate agent state before operations"

---

## ADR-005: Isolated Agent Failures

**Status:** Accepted

**Context:**
One agent failing shouldn't crash the entire system or affect other agents.

**Decision:**
Wrap all agent operations in try-catch. Return errors in result objects rather than throwing.

**Rationale:**

- System resilience - one bad agent doesn't break others
- Easier to debug - see which agent failed and why
- Better user experience - partial results better than total failure
- Aligns with microservices patterns

**Implementation Pattern:**

```typescript
// Execute capability on multiple agents
async executeCapability<T, R>(capability: string, params: T): Promise<CapabilityResult<R>[]> {
  const agents = this.findAgentsByCapability(capability);
  const results: CapabilityResult<R>[] = [];

  // Execute each agent independently with error isolation
  for (const agent of agents) {
    const startTime = Date.now();
    try {
      const result = await agent.execute<T, R>(capability, params);
      results.push({
        agentId: agent.id,
        result,
        success: true,
        duration: Date.now() - startTime
      });
    } catch (error) {
      // Log but don't throw - continue processing other agents
      console.error(`Agent ${agent.id} failed executing ${capability}:`, error);
      results.push({
        agentId: agent.id,
        result: undefined as any,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  return results;
}
```

**Reference in comments:** "Following ADR-005: Isolate agent failures with try-catch"

---

## ADR-006: Subscription Cleanup Pattern

**Status:** Accepted

**Context:**
Agents and orchestrator components subscribe to events. Need clean cleanup to prevent memory leaks.

**Decision:**
Store unsubscribe functions in an array. Call all on cleanup.

**Rationale:**

- Simple pattern that's hard to get wrong
- Works with any event system that returns unsubscribe function
- Easy to audit (check subscriptions.length)
- Prevents common memory leak

**Implementation Pattern:**

```typescript
export abstract class BaseAgent implements IAgent {
  protected subscriptions: (() => void)[] = [];

  subscribe<T>(eventType: string, handler: EventHandler<T>): () => void {
    const unsubscribe = this.eventBus.subscribe(eventType, handler);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  async cleanup(): Promise<void> {
    // Unsubscribe from all events
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions = [];

    // Subclass cleanup
    await this.onCleanup();
  }
}
```

**Reference in comments:** "Following ADR-006: Subscription cleanup pattern"

---

## ADR-007: Module Federation Loading

**Status:** Accepted

**Context:**
Agents need to be loaded dynamically as MFEs without bundling them into the host.

**Decision:**
Use Webpack Module Federation with manifest-based loading.

**Rationale:**

- Industry standard for MFE loading
- Independent deployment of agents
- Shared dependencies handled automatically
- Version management built-in

**Implementation Pattern:**

```typescript
async loadAgent(manifest: AgentManifest): Promise<void> {
  // Following ADR-007: Module Federation loading pattern

  // Step 1: Load remote entry script
  const script = document.createElement('script');
  script.src = manifest.remote.url;
  script.type = 'text/javascript';

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  // Step 2: Get container from global scope
  const container = (window as any)[manifest.remote.scope];
  if (!container) {
    throw new Error(`Container ${manifest.remote.scope} not found`);
  }

  // Step 3: Initialize container
  await container.init(__webpack_share_scopes__.default);

  // Step 4: Get module factory
  const factory = await container.get(manifest.remote.module);
  const module = factory();

  // Step 5: Register agent
  await this.registerAgent(manifest, module.default);
}
```

**Reference in comments:** "Following ADR-007: Module Federation loading"

---

## ADR-008: TypeScript Strict Mode

**Status:** Accepted

**Context:**
Project needs type safety to catch errors early and enable good Copilot suggestions.

**Decision:**
Enable all TypeScript strict mode flags.

**Rationale:**

- Copilot generates better code with strong types
- Catches null/undefined errors at compile time
- Forces explicit typing (no implicit any)
- Makes refactoring safer

**Configuration:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Reference in comments:** "Following ADR-008: Use strict TypeScript"

---

## How to Use ADRs with Copilot

When implementing, reference the relevant ADR in your comments:

```typescript
/**
 * Execute capability across all matching agents.
 *
 * Following ADR-002: Use capability index for O(1) lookup
 * Following ADR-005: Isolate agent failures with try-catch
 *
 * Implementation:
 * 1. Get agent IDs from capability index
 * 2. Execute each agent with error isolation
 * 3. Return array of results
 */
async executeCapability<T, R>(capability: string, params: T): Promise<CapabilityResult<R>[]> {
  // Copilot will follow the ADR patterns
}
```

This tells Copilot exactly which architectural patterns to use.

---

## ADR-009: Hybrid Orchestration Architecture

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** MFE Orchestration System

**Context:**
Need to orchestrate dynamic runtime composition of MFEs (including AI agents/tools) across distributed environments. Must support 100+ MFEs with sub-5 second availability while maintaining performance and enabling offline capability.

**Decision:**
Implement hybrid architecture combining:

1. **Centralized Orchestration Service** - single source of truth for MFE registry
2. **Distributed Shell Runtime** - local execution and caching in each shell application

**Rationale:**

- **Centralized service** provides consistent view across multiple shells and enables cross-shell coordination
- **Distributed runtime** ensures performance, reduces latency, and enables offline operation
- **Separation of concerns** - service manages state, shell manages execution
- Scalable - multiple shells can share orchestration service
- Hybrid approach balances consistency (CP) with availability/performance (AP)

**Implementation Pattern:**

```typescript
// Orchestration Service (Node.js/Express)
class OrchestrationService {
  private registry: Map<string, MFERegistryEntry> = new Map();
  private wsServer: WebSocketServer;

  // Following ADR-009: Lightweight registry storing metadata only
  async register(mfe: MFERegistration): Promise<void> {
    const entry: MFERegistryEntry = {
      name: mfe.name,
      version: mfe.version,
      type: mfe.type,
      endpoint: mfe.endpoint,
      remoteEntry: mfe.remoteEntry,
      dslEndpoint: mfe.dslEndpoint, // Pointer, not full DSL
      healthCheck: mfe.healthCheck,
      status: 'healthy',
      registeredAt: new Date(),
      lastSeen: new Date(),
    };

    this.registry.set(mfe.name, entry);

    // Broadcast to all connected shells
    this.wsServer.broadcast({
      type: 'mfe.registered',
      payload: entry,
    });
  }

  // Phase A discovery - return lightweight registry
  async getRegistry(): Promise<MFERegistryEntry[]> {
    return Array.from(this.registry.values());
  }
}

// Shell Runtime Orchestration (React)
class ShellOrchestrator {
  private localRegistry: Map<string, MFERegistryEntry> = new Map();
  private loadedMFEs: Map<string, any> = new Map();
  private ws: WebSocket;

  constructor() {
    // Following ADR-009: WebSocket for real-time sync
    this.ws = new WebSocket('ws://orchestration-service/ws');
    this.ws.onmessage = (msg) => this.handleRegistryUpdate(msg);
  }

  // Following ADR-009: On-demand DSL fetch
  async fetchMFEDSL(mfeName: string): Promise<MFEDSL> {
    const entry = this.localRegistry.get(mfeName);
    if (!entry) throw new Error(`MFE ${mfeName} not found`);

    // Fetch from MFE's dslEndpoint, not from orchestration service
    const response = await fetch(entry.dslEndpoint);
    return response.json();
  }

  // Dynamic Module Federation loading
  async loadMFE(mfeName: string): Promise<void> {
    const entry = this.localRegistry.get(mfeName);
    if (!entry?.remoteEntry) return;

    // Following ADR-007: Module Federation loading
    const module = await this.loadRemoteModule(entry.remoteEntry);
    this.loadedMFEs.set(mfeName, module);
  }
}
```

**Consequences:**

- Positive: Best of both centralized and distributed approaches
- Positive: Enables offline mode with cached registry
- Positive: Real-time updates without polling overhead
- Negative: More complex than pure centralized or distributed
- Negative: Need to handle network partitions gracefully

**Reference in comments:** "Following ADR-009: Hybrid orchestration with centralized service + shell runtime"

---

## ADR-010: Lightweight Registry with DSL Endpoints

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** MFE Orchestration System

**Context:**
MFE DSL documents can be arbitrarily large and complex (especially for AI tools with extensive capability declarations). Storing full DSL in centralized registry creates scaling bottleneck and memory concerns.

**Decision:**
Registry stores only **metadata + pointer to DSL endpoint**. Full DSL fetched on-demand when needed.

**Rationale:**

- Keeps registry nimble - O(1) operations even with 100+ MFEs
- Supports unpredictable DSL sizes without registry bloat
- MFEs own their DSL - can update without re-registering
- Enables direct interrogation of MFE capabilities
- Reduces orchestration service memory footprint
- Faster registry synchronization (smaller payloads)

**Registry Entry Structure:**

```typescript
interface MFERegistryEntry {
  // Identity
  name: string;
  version: string;
  type: 'ui-component' | 'tool' | 'agent' | 'api' | 'skill';

  // Discovery metadata (lightweight)
  description?: string;
  tags?: string[];

  // Endpoints (pointers)
  endpoint: string; // Service endpoint for REST/gRPC
  remoteEntry?: string; // Module Federation entry point
  dslEndpoint: string; // Where to fetch full DSL: /.well-known/mfe-manifest.yaml
  healthCheck: string; // Health check endpoint

  // Status
  status: 'healthy' | 'unhealthy' | 'unknown';
  registeredAt: Date;
  lastSeen: Date;
}

// Full DSL fetched separately on-demand
interface MFEDSL {
  name: string;
  version: string;
  description: string;
  capabilities: Capability[]; // Can be arbitrarily large
  lifecycle: LifecycleHooks;
  dependencies: Dependency[];
  // ... extensive capability declarations
}
```

**Implementation Pattern:**

```typescript
// Following ADR-010: Fetch DSL on-demand, not at registration
class AgentDiscovery {
  async discoverMFEs(query: string): Promise<MFEDSL[]> {
    // Step 1: Get lightweight registry
    const registry = await orchestrationService.getRegistry();

    // Step 2: Filter based on metadata (cheap)
    const candidates = registry.filter(
      (entry) => entry.type === 'tool' && entry.status === 'healthy'
    );

    // Step 3: Fetch full DSL only for candidates (expensive, on-demand)
    const dsls = await Promise.all(
      candidates.map((entry) => fetch(entry.dslEndpoint).then((r) => r.json()))
    );

    // Step 4: Agent evaluates full DSL
    return this.evaluateWithLLM(query, dsls);
  }
}
```

**Consequences:**

- Positive: Registry scales to 1000+ MFEs without memory issues
- Positive: Supports dynamic DSL updates without re-registration
- Positive: Faster registry queries and synchronization
- Negative: Requires additional network call to get full DSL
- Negative: MFEs must serve their own DSL endpoint
- Mitigation: Shell can cache fetched DSLs locally

**Reference in comments:** "Following ADR-010: Lightweight registry, fetch DSL on-demand"

---

## ADR-011: Three-Phase Discovery Strategy

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** MFE Orchestration System - AI Agent Discovery

**Context:**
AI agents need flexibility to discover and select MFEs. Different scenarios require different levels of autonomy vs precision. Need to balance "emergent behaviors" with "deterministic outcomes".

**Decision:**
Support three discovery phases, used in order of preference:

- **Phase A (Probabilistic)**: Return all MFE DSLs, agent uses LLM reasoning to select
- **Phase C (Semantic)**: Natural language query, orchestration returns ranked matches
- **Phase B (Deterministic)**: Query DSL with precise filtering

**Rationale:**

- "Go from probabilistic to deterministic" - enables **dynamic experiences first**
- Phase A maximizes agent autonomy and enables emergent behaviors
- Phase C balances flexibility with performance (pre-filtering)
- Phase B provides precision when repeatability required
- Agent chooses phase based on task confidence and context
- Progression from flexible → assisted → prescriptive

**Implementation Pattern:**

```typescript
// Following ADR-011: Multi-phase discovery
interface DiscoveryAPI {
  // Phase A: Probabilistic - maximum flexibility
  async getAllMFEs(): Promise<MFERegistryEntry[]> {
    // Return lightweight registry index
    // Agent fetches full DSLs for candidates
    return this.registry.getAll();
  }

  // Phase C: Semantic - natural language ranking
  async searchMFEs(query: string): Promise<ScoredMFE[]> {
    // Use embeddings/vector search
    const embedding = await this.embedQuery(query);
    const matches = await this.vectorSearch(embedding);

    return matches.map(m => ({
      mfe: m.entry,
      score: m.similarity,
      reasoning: m.explanation
    }));
  }

  // Phase B: Deterministic - precise filtering
  async queryMFEs(filter: QueryFilter): Promise<MFERegistryEntry[]> {
    // Parse query DSL: type=tool AND capabilities.includes('data-analysis')
    return this.registry.query(filter);
  }
}

// Agent chooses phase based on context
class AgentOrchestrator {
  async selectMFE(task: Task): Promise<string> {
    if (task.confidence === 'high' && task.previousSuccess) {
      // Use Phase B - we know exactly what we need
      return this.deterministic(task);
    } else if (task.confidence === 'medium') {
      // Use Phase C - semantic search helps narrow down
      return this.semantic(task);
    } else {
      // Use Phase A - explore all options
      return this.probabilistic(task);
    }
  }
}
```

**Phase Characteristics:**
| Phase | Query Method | Selection | Repeatability | Use Case |
|-------|-------------|-----------|---------------|----------|
| A | Get all | Agent reasoning | Low | Exploration, learning |
| C | Natural language | Ranked results | Medium | Assisted discovery |
| B | Query DSL | Exact match | High | Production, known requirements |

**Consequences:**

- Positive: Supports both exploration and exploitation
- Positive: Agents learn over time (A→C→B progression)
- Positive: System evolves from dynamic to prescriptive
- Negative: Phase C requires ML infrastructure (embeddings, vector DB)
- Negative: Three implementations to maintain
- Mitigation: Phase A is foundation, implement first; C and B are progressive enhancements

**Reference in comments:** "Following ADR-011: Three-phase discovery (A→C→B)"

---

## ADR-012: Push-Based MFE Registration

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** MFE Orchestration System

**Context:**
MFEs need to register with orchestration service to become discoverable. Must achieve <5 second availability after deployment and support zero manual configuration.

**Decision:**
MFEs **push register** on startup with auto-generated registration code. CLI templates include registration logic automatically.

**Rationale:**

- **Zero manual configuration** - developers don't write registration code
- **Immediate availability** - no waiting for discovery polling
- **Simple failure handling** - MFE knows immediately if registration failed
- **Clear ownership** - MFE responsible for its own registration
- Industry standard (Consul, Eureka use push registration)

**Implementation Pattern:**

```typescript
// Following ADR-012: Auto-generated registration code in MFE template
// Generated by: mfe remote csv-analyzer

// src/orchestration/register.ts (auto-generated)
export async function registerMFE() {
  const orchestrationUrl = process.env.ORCHESTRATION_SERVICE_URL || 'http://localhost:3100';

  const registration = {
    name: 'csv-analyzer',
    version: '1.0.0',
    type: 'tool',
    endpoint: process.env.MFE_ENDPOINT || 'http://localhost:3002',
    remoteEntry: process.env.MFE_REMOTE_ENTRY || 'http://localhost:3002/remoteEntry.js',
    dslEndpoint: `${process.env.MFE_ENDPOINT}/.well-known/mfe-manifest.yaml`,
    healthCheck: `${process.env.MFE_ENDPOINT}/health`,
  };

  try {
    const response = await fetch(`${orchestrationUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration),
    });

    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`);
    }

    console.log(`✓ Registered with orchestration service: ${registration.name}`);
    return true;
  } catch (error) {
    console.error('Failed to register with orchestration service:', error);
    // Continue running even if registration fails (degraded mode)
    return false;
  }
}

export async function deregisterMFE() {
  const orchestrationUrl = process.env.ORCHESTRATION_SERVICE_URL;
  if (!orchestrationUrl) return;

  await fetch(`${orchestrationUrl}/api/deregister`, {
    method: 'POST',
    body: JSON.stringify({ name: 'csv-analyzer' }),
  });
}

// src/index.ts (auto-generated)
import { registerMFE, deregisterMFE } from './orchestration/register';

async function start() {
  // Start MFE server
  await startServer();

  // Register with orchestration (non-blocking)
  registerMFE().catch((err) => console.error('Registration error:', err));
}

// Graceful shutdown with de-registration
process.on('SIGTERM', async () => {
  await deregisterMFE();
  process.exit(0);
});

start();
```

**Registration Flow:**

```
Developer runs: mfe remote csv-analyzer
         ↓
CLI generates MFE with registration code
         ↓
Developer runs: npm start
         ↓
MFE starts server
         ↓
MFE.registerMFE() → POST /api/register
         ↓
Orchestration service stores entry
         ↓
Service broadcasts via WebSocket
         ↓
All shells receive update (<5 seconds)
         ↓
MFE is discoverable
```

**Error Handling:**

- Registration failure doesn't crash MFE (continue in degraded mode)
- Retry with exponential backoff if orchestration service unavailable
- Health check endpoint still responds even if unregistered
- De-registration on SIGTERM, SIGINT (graceful shutdown)

**Consequences:**

- Positive: <5 second availability requirement met
- Positive: Zero manual configuration
- Positive: MFE self-contained (can run without orchestration)
- Negative: Requires orchestration service to be running
- Mitigation: MFE continues running if registration fails

**Reference in comments:** "Following ADR-012: Auto-generated push registration"

---

## ADR-013: Language-Agnostic DSL Contract

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** MFE Orchestration System

**Context:**
Need to support MFEs built in different languages (JavaScript, Python, Go, etc.) within same orchestration ecosystem. AI agents must understand capabilities regardless of implementation language.

**Decision:**
Define MFE capabilities using **language-agnostic YAML/JSON DSL** with JSON Schema validation. DSL describes "what" (capabilities, contracts) not "how" (implementation).

**Rationale:**

- Enables **polyglot ecosystem** - any language can participate
- Machine-readable by AI agents (LLM-friendly)
- Declarative > imperative for agent reasoning
- JSON Schema provides validation and documentation
- Industry standard (OpenAPI, Kubernetes use YAML/JSON)
- Separates contract from implementation

**DSL Structure:**

```yaml
# Following ADR-013: Language-agnostic DSL
# /.well-known/mfe-manifest.yaml

name: csv-analyzer
version: 1.0.0
type: tool
description: Analyzes CSV files and generates statistical summaries
language: javascript # Can be: javascript, python, go, rust, etc.

# Capabilities with inputs/outputs
capabilities:
  - data-analysis:
      description: Statistical analysis of CSV data
      inputs:
        - name: file
          type: file
          formats: [csv, tsv]
          required: true
        - name: analysis-type
          type: enum
          values: [summary, correlation, regression]
          required: false
      outputs:
        - name: report
          type: object
          schema:
            $ref: '#/components/schemas/AnalysisReport'

      # Lifecycle hooks with handlers
      lifecycle:
        - before:
            - validateFile:
                handler: validateCsvFile
                requiredInput: file
                authorization: user.permission.read
        - main:
            - process:
                handler: processCsvFile
                requiredInput: file
                authorization: user.permission.read
        - after:
            - report:
                handler: createAnalysisReport
                requiredInput: processedData
        - error:
            - handleError:
                handler: logAndNotifyError

# Module Federation (for web MFEs)
remoteEntry: http://localhost:3002/remoteEntry.js

# REST/gRPC endpoint (for service MFEs)
endpoint: http://localhost:3002

# Dependencies
dependencies:
  - design-system@^1.2.0

# JSON Schema for validation
components:
  schemas:
    AnalysisReport:
      type: object
      properties:
        summary: { type: object }
        correlations: { type: array }
```

**Handler Invocation (Language-Specific):**

JavaScript (Module Federation):

```typescript
// Agent loads via Module Federation
const mfeModule = await loadRemoteModule(remoteEntry);
const result = await mfeModule.handlers.processCsvFile({ file });
```

Python (REST API):

```python
# Agent calls REST endpoint
@app.post("/invoke/processCsvFile")
async def process_csv_file(params: FileParams):
    # Implementation in Python
    return analyze_csv(params.file)
```

Go (gRPC):

```go
// Agent calls gRPC endpoint
func (s *server) ProcessCsvFile(ctx context.Context, req *FileRequest) (*AnalysisReport, error) {
    // Implementation in Go
    return analyzeCsv(req.File)
}
```

**Platform Contract (Required Fields):**
Every MFE MUST provide:

- `name`, `version`, `type`, `description`
- `capabilities` array with at least one capability
- Either `remoteEntry` (web) or `endpoint` (service)
- `/.well-known/mfe-manifest.yaml` endpoint
- `/health` endpoint

**Consequences:**

- Positive: True polyglot ecosystem possible
- Positive: AI agents can reason about any MFE
- Positive: Implementation flexibility
- Negative: Need adapters for different invocation patterns (MF vs REST vs gRPC)
- Negative: Cross-language type mapping complexity
- Mitigation: JSON Schema provides common type system

**Reference in comments:** "Following ADR-013: Language-agnostic DSL contract"

---

## ADR-014: Self-Building System Design

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** MFE Orchestration System - Ultimate Validation

**Context:**
Need to validate that orchestration design truly enables extensibility and autonomy. Best validation: system can extend itself.

**Decision:**
Design orchestration to support "drinking our own wine" - **tools that generate tools that are immediately usable**.

**Rationale:**

- Ultimate test of orchestration design
- Proves zero-config integration works
- Enables autonomous system evolution
- Validates DSL abstraction is sufficient
- Creates positive feedback loop (better tools → better tools)

**Requirements:**

1. Code generator MFE can create new MFE projects
2. Generated MFEs conform to platform DSL contract
3. Generated MFEs auto-register on deployment
4. Circular validation: generated MFE can generate more MFEs
5. No manual intervention required

**Implementation Example:**

```typescript
// MFE: mfe-code-generator (tool that generates MFEs)
// /.well-known/mfe-manifest.yaml
{
  name: 'mfe-code-generator',
  type: 'tool',
  capabilities: [{
    'code-generation': {
      inputs: [{
        name: 'spec',
        type: 'object',
        schema: {
          type: 'mfe-type',
          name: 'string',
          capabilities: 'array'
        }
      }],
      outputs: [{
        name: 'project',
        type: 'directory',
        contains: ['package.json', 'src/', 'mfe-manifest.yaml']
      }]
    }
  }]
}

// Agent workflow: "Create a CSV analyzer tool"
1. Agent discovers mfe-code-generator via Phase A discovery
2. Agent invokes code-generation capability:
   {
     type: 'tool',
     name: 'csv-analyzer',
     capabilities: ['data-analysis']
   }
3. Generator creates:
   - Project structure
   - Package.json
   - src/handlers/processCsv.ts
   - mfe-manifest.yaml (conforming to ADR-013)
   - Registration code (following ADR-012)
4. Generated project deployed: npm start
5. csv-analyzer auto-registers (ADR-012)
6. csv-analyzer available <5 seconds (ADR-001)
7. csv-analyzer can now be used by agents
8. Circular: csv-analyzer could invoke mfe-code-generator to create more tools
```

**Self-Building Validation Tests:**

```typescript
describe('Self-Building System', () => {
  it('should generate MFE that auto-registers', async () => {
    // Invoke code generator
    const project = await agent.execute('code-generation', {
      type: 'tool',
      name: 'test-tool',
      capabilities: ['test-capability'],
    });

    // Deploy generated project
    await deployProject(project);

    // Verify auto-registration within 5 seconds
    await waitFor(() => orchestration.registry.has('test-tool'), { timeout: 5000 });

    // Verify tool is usable
    const result = await agent.discoverAndInvoke('test-capability', {});
    expect(result).toBeDefined();
  });

  it('should support circular generation', async () => {
    // Generated tool generates another tool
    const tool1 = await codeGenerator.generate({ name: 'generator-2' });
    deploy(tool1);

    const tool2 = await generator2.generate({ name: 'analyzer' });
    deploy(tool2);

    // Both tools usable
    expect(await orchestration.registry.has('generator-2')).toBe(true);
    expect(await orchestration.registry.has('analyzer')).toBe(true);
  });
});
```

**Consequences:**

- Positive: Proves orchestration design is sound
- Positive: Enables rapid ecosystem growth
- Positive: System can evolve autonomously
- Negative: Generated code quality depends on generator quality
- Negative: Potential for runaway generation (needs governance)
- Mitigation: Include validation, rate limiting, approval workflows

**Success Metrics:**

- First generated MFE works without manual fixes
- Generated MFE passes all platform contract validations
- <5 second availability after generation and deployment
- Circular generation (gen1 → gen2 → gen3) works

**Reference in comments:** "Following ADR-014: Self-building system design"

---

## Orchestration ADR Summary

**Core Architecture:**

- ADR-009: Hybrid orchestration (centralized + distributed)
- ADR-010: Lightweight registry with DSL endpoints
- ADR-012: Push-based MFE registration
- ADR-013: Language-agnostic DSL contract

**Discovery & Selection:**

- ADR-011: Three-phase discovery (A→C→B)

**System Evolution:**

- ADR-014: Self-building capability

**Reference Pattern:**

```typescript
/**
 * Agent discovers and invokes MFE capability
 *
 * Following ADR-009: Hybrid orchestration architecture
 * Following ADR-010: Fetch DSL on-demand from MFE endpoint
 * Following ADR-011: Three-phase discovery for agent flexibility
 * Following ADR-013: Language-agnostic DSL evaluation
 */
async discoverAndInvoke(capability: string, params: unknown): Promise<unknown> {
  // Implementation follows ADR patterns
}
```

---

## ADR-015: Relocate Generated Workspace Examples

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** Repository Hygiene & Developer Experience

**Context:**
Early CLI runs and exploratory tests generated example workspaces (`npm-workspace/`, `yarn-workspace/`) in the repository root. Keeping scaffold examples at the root created noise and blurred the line between tooling source and reference templates.

**Decision:**
Move all persistent scaffold examples into `examples/workspaces/<package-manager>/` and remove root-level workspace folders. Treat them strictly as reference templates; they are not part of the CLI runtime or orchestration implementation.

**Rationale:**

- Cleaner root focusing contributors on `src/`, `docs/`, `agent-orchestrator/`.
- Single convention: all samples under `examples/`.
- Prevents accidental commits of ad‑hoc test scaffolds.
- Improves onboarding—clear separation of source vs examples.

**Implementation Layout:**

```
examples/
  workspaces/
    npm/
      README.md
      package.json
      mfe-spec.yaml
      apps/  packages/  docs/
    yarn/
      README.md
      package.json
      mfe-spec.yaml
      apps/  packages/  docs/
```

**Repository Guardrails:**

1. Cleanup script (`scripts/clean-test-workspaces.js`) removes stray `*-test` directories.
2. Unit tests use mocks; integration tests (future) will isolate under `scripts/tmp/`.
3. Root `README.md` links to examples section for discoverability.

**Consequences:**

- Positive: Reduced root clutter.
- Positive: Easier to evolve examples independently.
- Negative: Slight indirection (one more path to reach examples).
- Mitigation: Prominent README link and ADR reference.

**Reference in comments:** "Following ADR-015: Use examples/workspaces for scaffold templates"

---

## ADR-016: Orchestration Service per Shell

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** Session 2 - Scope & Architecture

**Context:**
Need to determine where orchestration service lives and how it's deployed. Options include standalone service, shared service, or embedded in shell.

**Decision:**
**Orchestration service is generated in EVERY shell** and deployed together as single unit via Docker Compose.

**Rationale:**

- **Natural ownership** - shell owns its orchestration, clear responsibility
- **Deployment simplicity** - one command deploys both (docker-compose up)
- **Host → Remote workflow** - elegant pattern where shell is host, remotes register
- **Isolation** - each shell has independent registry (can share if needed via config)
- **Consistent with tool philosophy** - generate everything, including infrastructure
- **Docker Compose elegance** - service discovery automatic within compose network
- **Development experience** - same deployment model dev through prod

**Shell Generation Structure:**

```
my-shell/
├── src/                           # Shell application (React)
│   ├── App.tsx
│   ├── orchestration-runtime/     # Browser-side orchestration
│   │   ├── registry-cache.ts
│   │   ├── mfe-loader.ts          # Module Federation
│   │   ├── discovery.ts           # Phase A/C/B
│   │   └── websocket-client.ts
│   └── ...
├── orchestration-service/         # Backend service (Node.js)
│   ├── server.ts                  # Express/Fastify
│   ├── registry/
│   │   ├── storage.ts             # Redis/Memory
│   │   └── sync.ts
│   ├── api/
│   │   ├── register.ts            # POST /api/register
│   │   ├── discover.ts            # GET /api/mfes
│   │   └── query.ts               # Phase A/C/B endpoints
│   └── websocket/
│       └── broadcast.ts           # Real-time sync
├── docker-compose.yml             # Dev environment
├── docker-compose.prod.yml        # Prod overrides
├── Dockerfile.shell
└── Dockerfile.orchestration
```

**Generated Docker Compose:**

```yaml
version: '3.8'
services:
  orchestration-service:
    build:
      context: ./orchestration-service
    ports:
      - '3100:3100'
    environment:
      - NODE_ENV=${NODE_ENV:-development}
      - REGISTRY_STORAGE=${REGISTRY_STORAGE:-memory}
    depends_on:
      - redis

  shell:
    build:
      context: .
      dockerfile: Dockerfile.shell
    ports:
      - '3000:3000'
    environment:
      - ORCHESTRATION_URL=http://orchestration-service:3100
    depends_on:
      - orchestration-service

  redis:
    image: redis:alpine
```

**Deployment Workflow:**

```bash
# Generate shell (includes orchestration)
mfe shell my-app

# Deploy everything
cd my-app
docker-compose up -d
# Shell + orchestration service + redis all start together

# Remotes register when they start
cd ../my-remote
npm run dev  # Registers with localhost:3100
```

**Consequences:**

- Positive: Simplest deployment model - one command
- Positive: Clear ownership - shell owns its orchestration
- Positive: Flexible - can configure multiple shells to share one orchestration
- Positive: Isolated - each developer has own registry
- Negative: Each shell needs orchestration (but small overhead)
- Mitigation: Orchestration service is lightweight, can be shared via config

**Reference in comments:** "Following ADR-016: Orchestration service generated with shell"

---

## ADR-017: Docker-Only Orchestration, Dev Servers for MFEs

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** Session 2 - Environment Strategy

**Context:**
Need to determine how orchestration and MFEs run in development. Options include all in Docker, all as dev servers, or hybrid.

**Decision:**
**Orchestration always runs in Docker containers** (dev, staging, prod). **MFEs run as dev servers** in development for hot reload.

**Rationale:**

- **Consistent infrastructure** - orchestration deployment identical across environments
- **Hot reload where it matters** - MFEs get fast refresh during active development
- **Clean separation** - infrastructure (orchestration) vs application code (MFEs)
- **Production-like dev** - orchestration behaves same way in all environments
- **No hybrid confusion** - clear rule: orchestration = Docker, MFEs = dev server (dev only)
- **Best of both** - stability of containers + speed of dev servers

**Development Architecture:**

```
┌─────────────────────────────────────┐
│  Docker Compose                     │
│  ┌─────────────────────────────┐   │
│  │ shell:3000                  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ orchestration-service:3100  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ redis:6379                  │   │
│  └─────────────────────────────┘   │
└──────────────▲──────────────────────┘
               │
               │ Register via HTTP
               │
    ┌──────────┼──────────┬──────────┐
    │          │          │          │
Dev Server  Dev Server  Dev Server  Dev Server
feature-a   feature-b   tool-x      api-y
:3001       :3002       :3003       :3004
(npm run dev with hot reload)
```

**Implementation Pattern:**

```bash
# Terminal 1: Start infrastructure (Docker)
cd my-shell
docker-compose up
# Starts: shell, orchestration-service, redis

# Terminal 2-N: Start MFEs (dev servers)
cd ../feature-a
npm run dev  # Port 3001, auto-registers with localhost:3100

cd ../feature-b
npm run dev  # Port 3002, auto-registers with localhost:3100
```

**Auto-Generated Registration Code:**

```typescript
// In every generated MFE
export async function registerMFE() {
  const orchestrationUrl = process.env.ORCHESTRATION_URL || 'http://localhost:3100'; // Dev default

  const registration = {
    name: 'feature-a',
    endpoint: process.env.MFE_ENDPOINT || 'http://localhost:3001',
    remoteEntry: process.env.REMOTE_ENTRY || 'http://localhost:3001/remoteEntry.js',
    dslEndpoint: `${process.env.MFE_ENDPOINT || 'http://localhost:3001'}/.well-known/mfe-manifest.yaml`,
    healthCheck: `${process.env.MFE_ENDPOINT || 'http://localhost:3001'}/health`,
  };

  await fetch(`${orchestrationUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration),
  });
}

// Auto-called on startup
if (process.env.NODE_ENV !== 'test') {
  registerMFE().catch(console.error);
}
```

**Environment Progression:**
| Environment | Orchestration | MFEs | Registry |
|-------------|--------------|------|----------|
| Development | Docker | Dev servers | In-memory |
| Staging | Docker | Docker | Redis |
| Production | Docker | Docker | Redis |

**Consequences:**

- Positive: Consistent orchestration behavior across environments
- Positive: Fast hot reload for MFEs during development
- Positive: Simple mental model - infrastructure vs application
- Positive: Docker Compose overlay files for environment configs
- Negative: Developers must run Docker for infrastructure
- Mitigation: Minimal Docker footprint (orchestration is lightweight)

**Reference in comments:** "Following ADR-017: Docker-only orchestration, dev servers for MFEs"

---

## ADR-018: Abstract MFE Base Class with Standard Capabilities

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** Session 2 - Platform DSL Contract

**Context:**
Need uniform interface for all MFEs regardless of type (UI/Tool/Agent/API) or implementation language. Must support runtime introspection by AI agents.

**Decision:**
Define **abstract MFE base class** with required standard capabilities that ALL MFEs must implement. Use **GraphQL-style schema** for introspection.

**Rationale:**

- **Uniform interface** - all MFEs (UI/Tool/Agent/API) implement same methods
- **Language agnostic** - abstract contract, any language can implement
- **Self-documenting** - introspection via GraphQL schema
- **Agent-friendly** - agents already understand GraphQL
- **Type safety** - GraphQL provides strong typing
- **Industry standard** - leverages existing ecosystem (Apollo, graphql-js, strawberry, etc.)

**Required Standard Capabilities (Platform Contract):**

```yaml
# ALL MFEs must implement these capabilities
standardCapabilities:
  # 1. Authorization
  - authorizeAccess:
      handler: checkAuthorization
      inputs:
        - name: token
          type: jwt
          required: true
      outputs:
        - name: authorized
          type: boolean
        - name: permissions
          type: array

  # 2. Health check
  - health:
      handler: checkHealth
      outputs:
        - name: status
          type: enum
          values: [healthy, degraded, unhealthy]

  # 3. Self-description
  - describe:
      handler: describeSelf
      outputs:
        - name: dsl
          type: object

  # 4. Schema introspection (GraphQL)
  - schema:
      handler: introspectSchema
      outputs:
        - name: schema
          type: object
          format: graphql-schema

  # 5. Generic query (GraphQL)
  - query:
      handler: executeQuery
      inputs:
        - name: token
          type: jwt
        - name: query
          type: string
          format: graphql-query
      outputs:
        - name: data
          type: object
```

**Abstract Base Class (TypeScript):**

```typescript
// Following ADR-018: Abstract MFE base class
abstract class BaseMFE {
  // Standard capabilities (REQUIRED)
  abstract async authorizeAccess(token: JWT, context?: object): Promise<AuthResult>;
  abstract async checkHealth(): Promise<HealthStatus>;
  abstract async describeSelf(): Promise<DSLDocument>;
  abstract async introspectSchema(): Promise<GraphQLSchema>;
  abstract async executeQuery(token: JWT, query: string, variables?: object): Promise<QueryResult>;

  // MFE-specific capabilities (OPTIONAL)
  abstract async execute<T, R>(capability: string, params: T): Promise<R>;
}

// Concrete implementation
class UserManagementMFE extends BaseMFE {
  async introspectSchema(): Promise<GraphQLSchema> {
    return buildSchema(`
      type Query {
        users(filter: UserFilter): [User!]!
        user(id: ID!): User
      }
      
      type Mutation {
        createUser(input: CreateUserInput!): User!
      }
      
      type User {
        id: ID!
        name: String!
        email: String!
      }
    `);
  }

  async executeQuery(token: JWT, query: string): Promise<QueryResult> {
    if (!(await this.authorizeAccess(token))) {
      throw new UnauthorizedError();
    }
    return graphql({ schema: this.schema, source: query, contextValue: { token } });
  }
}
```

**Python Implementation:**

```python
# Following ADR-018: Abstract MFE base class
from abc import ABC, abstractmethod
from strawberry import Schema

class BaseMFE(ABC):
    @abstractmethod
    async def authorize_access(self, token: str) -> AuthResult:
        pass

    @abstractmethod
    async def check_health(self) -> HealthStatus:
        pass

    @abstractmethod
    async def introspect_schema(self) -> Schema:
        pass

    @abstractmethod
    async def execute_query(self, token: str, query: str) -> QueryResult:
        pass

class UserManagementMFE(BaseMFE):
    async def introspect_schema(self) -> Schema:
        return strawberry.Schema(Query, Mutation)

    async def execute_query(self, token: str, query: str) -> QueryResult:
        if not await self.authorize_access(token):
            raise UnauthorizedError()
        return await self.schema.execute(query)
```

**GraphQL Schema Benefits:**

- Introspection built-in (`__schema`, `__type` queries)
- Type system with validation
- Tools available (GraphiQL, Playground)
- Documentation generation
- Client code generation
- Agents understand GraphQL naturally

**Consequences:**

- Positive: Uniform interface across all MFE types and languages
- Positive: Self-documenting via GraphQL introspection
- Positive: Agents can query any MFE the same way
- Positive: Leverages existing GraphQL ecosystem
- Negative: Requires GraphQL library in every MFE
- Negative: Learning curve for non-GraphQL developers
- Mitigation: CLI generates boilerplate, examples provided

**Reference in comments:** "Following ADR-018: Abstract MFE base class with standard capabilities"

---

## ADR-019: JWT-Based Authorization for All MFE Access

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** Session 2 - Security & Authorization

**Context:**
Need consistent authorization model across all MFEs. Must support both user access and agent access. Authorization must be equivalent to what enables user to see/use MFE.

**Decision:**
Use **JWT tokens** for all MFE access. Every MFE implements `authorizeAccess` standard capability that validates JWT and returns permissions.

**Rationale:**

- **Industry standard** - JWT widely adopted, well understood
- **Stateless** - no session storage required
- **Portable** - works across languages and platforms
- **Rich claims** - can include user, roles, permissions, context
- **Agent-friendly** - agents can obtain and pass tokens
- **Consistent** - same mechanism for users and agents
- **Interoperable** - works with OAuth2, OIDC, custom auth

**JWT Structure:**

```typescript
interface MFEToken {
  // Standard claims
  sub: string; // User/agent ID
  iss: string; // Token issuer
  aud: string[]; // Intended audiences
  exp: number; // Expiration
  iat: number; // Issued at

  // MFE-specific claims
  permissions: string[]; // ['mfe.read', 'data.write', etc.]
  roles: string[]; // ['admin', 'developer', etc.]
  context?: {
    // Additional context
    team?: string;
    environment?: string;
    [key: string]: any;
  };
}
```

**Standard Capability Implementation:**

```typescript
// Following ADR-019: JWT authorization
class MyMFE extends BaseMFE {
  async authorizeAccess(token: JWT, context?: object): Promise<AuthResult> {
    try {
      // Validate JWT signature
      const decoded = await verifyJWT(token, this.publicKey);

      // Check expiration
      if (decoded.exp < Date.now() / 1000) {
        return { authorized: false, reason: 'Token expired' };
      }

      // Check required permissions
      const hasPermission = decoded.permissions.includes('mfe.my-mfe.access');

      return {
        authorized: hasPermission,
        permissions: decoded.permissions,
        userId: decoded.sub,
        roles: decoded.roles,
      };
    } catch (error) {
      return { authorized: false, reason: error.message };
    }
  }

  // All capability executions check auth first
  async execute(capability: string, params: any): Promise<any> {
    const authResult = await this.authorizeAccess(params.token);
    if (!authResult.authorized) {
      throw new UnauthorizedError(authResult.reason);
    }

    // Execute capability
    return this.handlers[capability](params);
  }
}
```

**Agent Access Pattern:**

```typescript
// Agent obtains token (from auth service or orchestration)
const agentToken = await getAgentToken({
  agentId: 'csv-analyzer-agent',
  permissions: ['mfe.*.query', 'data.read'],
});

// Agent uses token for all MFE interactions
const mfes = await orchestration.discover({ token: agentToken });
for (const mfe of mfes) {
  // authorizeAccess called automatically
  const result = await mfe.execute('data-analysis', {
    token: agentToken,
    data: csvData,
  });
}
```

**Token Propagation:**

```typescript
// Browser: User logs in, gets token
const userToken = await auth.login(credentials);

// Shell passes token to orchestration queries
const mfes = await shellOrchestrator.discover({ token: userToken });

// Shell passes token when loading MFEs
await shellOrchestrator.loadMFE('feature-a', { token: userToken });

// MFE validates token before rendering/executing
```

**Permission Naming Convention:**

```
mfe.<mfe-name>.<action>
mfe.csv-analyzer.access
mfe.csv-analyzer.execute
mfe.*.query          # Wildcard: query any MFE
data.read            # Resource permission
data.write
admin.*              # Role-based wildcard
```

**Future: Zanzibar-Style Tuples (Deferred):**

```typescript
// More granular authorization (future enhancement)
interface AuthorizationTuple {
  user: string;
  relation: string;
  object: string;
}
// Examples:
// user:alice#member@mfe:csv-analyzer
// agent:bot#executor@capability:data-analysis
```

**Consequences:**

- Positive: Industry-standard security
- Positive: Works for users and agents
- Positive: Stateless and scalable
- Positive: Rich permission model
- Negative: Token management complexity
- Negative: Requires secure key distribution
- Mitigation: Orchestration service can help with token management

**Reference in comments:** "Following ADR-019: JWT authorization for MFE access"

---

## ADR-020: mfe init for Workspace, Shell Explicit

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** Session 2 - CLI Command Structure

**Context:**
Need to define what `mfe init` command generates and how shells are created. Options include init generating shell, init being minimal, or init being comprehensive.

**Decision:**
**`mfe init` scaffolds workspace with remotes only**. **Shell is created explicitly** via `mfe shell` command.

**Rationale:**

- **Clear intent** - init = workspace setup, shell = application creation
- **Flexibility** - workspace can have 0, 1, or many shells
- **Orchestration coupling** - shell brings orchestration, should be intentional
- **Workspace-first** - init focuses on shared infrastructure
- **Gradual adoption** - can add shells later to existing workspace
- **Monorepo support** - workspace can organize shells and remotes

**Command Behavior:**

```bash
# mfe init - workspace only
mfe init my-project
# Creates:
my-project/
├── packages/
│   ├── remote-a/
│   ├── remote-b/
│   └── remote-c/
├── package.json           # Workspace root
├── tsconfig.base.json     # Shared TS config
├── .gitignore
└── README.md

# mfe shell - creates shell with orchestration
cd my-project
mfe shell apps/main-app
# Creates:
apps/
└── main-app/
    ├── src/                      # Shell application
    ├── orchestration-service/    # Orchestration backend
    ├── docker-compose.yml
    └── package.json
```

**Typical Workflows:**

**Monorepo Style:**

```bash
mfe init my-monorepo
cd my-monorepo

# Create shells
mfe shell apps/customer-portal
mfe shell apps/admin-dashboard

# Create remotes
mfe remote packages/shared-header
mfe remote packages/user-profile
mfe remote packages/analytics

# Structure:
my-monorepo/
├── apps/
│   ├── customer-portal/      (shell + orchestration)
│   └── admin-dashboard/      (shell + orchestration)
├── packages/
│   ├── shared-header/        (remote)
│   ├── user-profile/         (remote)
│   └── analytics/            (remote)
└── package.json
```

**Polyrepo Style:**

```bash
# Separate repositories
mkdir my-org && cd my-org

# Shell repo
mfe shell customer-portal
cd customer-portal
git init

# Remote repos
cd ../
mfe remote user-profile
cd user-profile
git init

# Each deployed independently
# Remotes register with shell's orchestration
```

**Init Command Options:**

```bash
mfe init <workspace>                  # Default: workspace with sample remotes
mfe init <workspace> --empty          # Workspace only, no remotes
mfe init <workspace> --monorepo       # Workspace with apps/ and packages/ structure
mfe init <workspace> --package-manager yarn  # Use yarn workspaces
```

**Consequences:**

- Positive: Clear separation of concerns
- Positive: Flexible workspace topology
- Positive: Shell creation is intentional (brings orchestration)
- Positive: Supports both monorepo and polyrepo
- Negative: Extra step to create shell
- Mitigation: Documentation and examples make it clear

**Reference in comments:** "Following ADR-020: mfe init for workspace, shell explicit"

---

## Session 2 ADR Summary

**New ADRs from Session 2:**

- ADR-016: Orchestration service generated in every shell
- ADR-017: Docker-only orchestration, dev servers for MFEs
- ADR-018: Abstract MFE base class with standard capabilities
- ADR-019: JWT-based authorization for all MFE access
- ADR-020: mfe init for workspace, shell explicit

**Complete ADR Set (Session 1 + Session 2):**

- ADR-009: Hybrid orchestration (centralized + distributed)
- ADR-010: Lightweight registry with DSL endpoints
- ADR-011: Three-phase discovery (A→C→B)
- ADR-012: Push-based MFE registration
- ADR-013: Language-agnostic DSL contract
- ADR-014: Self-building system design
- ADR-016: Orchestration service per shell
- ADR-017: Docker-only orchestration
- ADR-018: Abstract MFE base class
- ADR-019: JWT authorization
- ADR-020: mfe init workspace-first

**Reference Pattern:**

```typescript
/**
 * Generate shell with embedded orchestration service
 *
 * Following ADR-016: Orchestration service per shell
 * Following ADR-017: Docker-only orchestration
 * Following ADR-018: Generate abstract MFE base class
 * Following ADR-019: Include JWT auth boilerplate
 * Following ADR-020: Shell generated explicitly, not via init
 */
export async function generateShell(name: string): Promise<void> {
  // Implementation follows ADR patterns
}
```

---

## ADR-021: Deprecate `analyze` Command (Static Heuristic MFE Suggestions)

**Status:** Accepted  
**Date:** 2025-11-26  
**Context:** Command Lifecycle & Architectural Alignment

**Context:**  
The `analyze` command (`src/commands/analyze.js`) performs static heuristic analysis of a codebase (file name/domain pattern matching, local import relationships, inferred API call detection) to suggest potential Micro Frontend boundaries. The platform direction (ADR-009 through ADR-014, ADR-016–ADR-020) pivots discovery to runtime registration, DSL-driven capability contracts, and multi-phase orchestration (probabilistic/semantic/deterministic). Static import heuristics neither leverage DSL semantics nor reflect actual deployed/runtime behavior and risk encouraging premature boundary carving.

**Decision:**  
Deprecate the `analyze` command immediately (retain short-term with banner) and plan removal in a future major release. No refactor/investment will be made beyond minimal deprecation safety changes.

**Rationale:**

- Aligns tool surface with runtime + DSL-first strategy (ADR-009, ADR-010, ADR-011, ADR-013).
- Reduces maintenance burden (≈900 LOC untested, monolithic).
- Avoids misleading architectural guidance based on static structure vs capability contracts.
- Encourages adoption of self-describing DSL and orchestration discovery phases.
- Frees coverage efforts to focus on generator/orchestrator core.

**Changes Implemented (Phase 1 – Current Release):**

- Added deprecation banner on invocation.
- Replaced `process.exit(1)` with structured return object (`{ success: false }`).
- Added JSDoc `@deprecated` annotation.
- Updated CLI help text marking command deprecated and referencing ADR-021.
- Updated README with Deprecated Commands section (to be patched).

**Planned Removal Timeline:**

- Phase 1 (Current Minor): Deprecation notice, still callable.
- Phase 2 (Next Minor): Hidden from default help; shown only via `--show-deprecated` (future enhancement).
- Phase 3 (Next Major): Remove code, tests, help entry; retain ADR-021 as historical record + migration guidance.

**Migration Path:**

1. Define capabilities in `mfe-spec.yaml` / DSL manifest (ADR-013).
2. Register MFEs via push registration (ADR-012) → orchestration service populates lightweight registry (ADR-010).
3. Use Phase A (full registry + per-MFE DSL fetch) for exploratory reasoning.
4. Use Phase C semantic search & Phase B deterministic querying for refined selection (ADR-011).
5. Iterate boundaries informed by runtime telemetry (REQ-010 future) rather than static import graphs.

**Non-Goals:**

- No partial modularization of existing static analyzer.
- No attempt to auto-generate DSL manifests from heuristic output (separate future feature may implement explicit DSL derivation via `mfe-spec derive`).

**Consequences:**  
Positive: Streamlined architecture consistency, reduced test surface, clearer guidance.  
Negative: Loss of quick heuristic boundary suggestions for legacy monoliths.  
Mitigation: Documentation describes how to reason about boundaries using actual capability contracts and runtime usage.

**Rollback Criteria:**  
If significant user feedback indicates dependency on heuristic analysis for migration, we may temporarily freeze (without refactor) and introduce a DSL derivation command; otherwise proceed to planned removal.

**Reference in Comments:**  
"Following ADR-021: `analyze` deprecated – use runtime DSL discovery instead."

---
