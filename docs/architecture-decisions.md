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
    this.subscriptions.forEach(unsub => unsub());
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
