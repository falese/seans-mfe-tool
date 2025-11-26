# Copilot Instructions for Agent Orchestrator

## Project Context

You are working on a browser-based agent orchestration system and MFE tool kit that generates full stack mfe and a dynamically loading and orchestration framework for micro-frontends (MFEs) using Module Federation. Agents communicate via a typed event bus and expose capabilities through a standard interface. The goal of this project is to provide a robust, production-ready platform for building and managing MFEs with strong developer experience, security, and testing. The secondary goal is to describe a common DSL for how Agents, tools, or skills can be exposed via common module federation patterns. The tertiary goal is to develop this same archteicture to extend to hardware native "MFEs" that expose specific functionality the target platform for this goal is Raspberry PI.

We will start by reviewing the code base already created that generates full stack MFEs, identify issues and complete code coverage.

## Code Style

### TypeScript

- Use strict typing - no `any` types
- Prefer interfaces over type aliases for object shapes
- Use readonly for immutable properties
- Explicit return types on all public methods
- Use generics for type safety in event handling

### Naming Conventions

- Interfaces: `IInterfaceName` (e.g., `IAgent`, `IEventBus`)
- Types: `PascalCase` with descriptive suffix (e.g., `AgentManifest`, `EventHandler`)
- Classes: `PascalCase` (e.g., `Orchestrator`, `BaseAgent`)
- Methods: `camelCase`, verb-first (e.g., `registerAgent`, `executeCapability`)
- Events: `namespace.action` format (e.g., `agent.registered`, `capability.executed`)
- Private methods: prefix with underscore `_methodName`
- Protected fields: standard camelCase with `protected` keyword

### Error Handling

- Use custom error classes that extend Error
- Always wrap external calls in try-catch
- Log errors but don't let one agent crash the system
- Return error information in result objects, not exceptions for expected failures

### Async Patterns

- Always return Promise for operations that might be async
- Use `async/await` over `.then()` chains
- Parallel operations use `Promise.all()` with proper error handling
- Sequential operations when order matters

## Architecture Patterns

### Agent Contract

Every agent MUST implement `IAgent` interface with:

- Lifecycle methods: `initialize()`, `suspend()`, `resume()`, `cleanup()`
- Capability methods: `getCapabilities()`, `execute()`
- Communication: `subscribe()` to event bus
- Health: `getHealth()` for monitoring

### Event-Driven Communication

- All inter-agent communication goes through event bus
- Events are strongly typed with payload interfaces
- No direct agent-to-agent method calls
- Publish events for state changes, execution results

### Capability Routing

- Agents declare capabilities with name and version
- Orchestrator maintains index: capability → agent IDs
- Multiple agents can provide same capability
- Execute on all matching agents, return array of results

### Module Federation Loading

- Agents loaded dynamically via native Module Federation
- Each agent has manifest with remote entry URL
- Orchestrator handles loading and initialization
- Graceful failure if agent fails to load

## Comment Style for Copilot

### Method Implementation Prompts

```typescript
/**
 * Brief description of what this does.
 *
 * Implementation approach:
 * 1. Step one with specific detail
 * 2. Step two with specific detail
 * 3. Step three with specific detail
 *
 * @param paramName - What this parameter does
 * @returns What is returned
 */
methodName(paramName: Type): ReturnType {
  // Copilot will implement based on steps above
}
```

### Algorithm Guidance

```typescript
// Find all agents that provide the requested capability
// Use the capability index for O(1) lookup
// Filter out agents in 'suspended' or 'error' state
// Return array of agent instances
```

### Error Handling Guidance

```typescript
// Wrap in try-catch - agent errors should not crash orchestrator
// Log error with context (agent ID, capability name)
// Return error in result object with success: false
// Continue processing other agents even if one fails
```

## Type Definitions Reference

When implementing classes, always reference the interface:

- `IAgent` interface in `types/agent.types.ts`
- `IOrchestrator` interface in `types/orchestrator.types.ts`
- `IEventBus` interface in `types/eventbus.types.ts`

## Testing Patterns

Every feature should be developed with Test Driven development (TDD) in mind. Each new feature should be started with creating a failing test then making it pass.

Use Jest for unit tests and follow these patterns:

### Test Structure

```typescript
describe('ComponentName', () => {
  let instance: ComponentName;
  let mockDependency: jest.Mocked<IDependency>;

  beforeEach(() => {
    // Setup
  });

  describe('methodName', () => {
    it('should handle expected case', async () => {
      // Arrange - setup test data
      // Act - call the method
      // Assert - verify results
    });

    it('should handle error case', async () => {
      // Test error paths
    });
  });
});
```

## File Organization

- `/types` - Only interfaces and types, no implementations
- `/core` - Core orchestrator and event bus implementations
- `/agents` - Concrete agent implementations, one per directory
- `/utils` - Pure utility functions, no state
- `/__tests__` - Tests mirror source structure

## Common Patterns to Follow

### Subscription Cleanup

```typescript
private subscriptions: (() => void)[] = [];

// In subscribe method:
const unsubscribe = eventBus.subscribe(...);
this.subscriptions.push(unsubscribe);

// In cleanup:
this.subscriptions.forEach(unsub => unsub());
this.subscriptions = [];
```

### State Validation

```typescript
// Always validate state before operations
if (!this.registry.has(agentId)) {
  throw new AgentNotFoundError(agentId);
}

if (entry.state !== 'ready') {
  throw new InvalidStateError(agentId, entry.state);
}
```

### Event Publishing Pattern

```typescript
this.eventBus.publish<PayloadType>({
  type: SystemEventTypes.EVENT_NAME,
  timestamp: new Date().toISOString(),
  source: this.id,
  payload: {
    /* typed payload */
  },
  correlationId: context.correlationId,
});
```

## What to Avoid

- ❌ Using `any` type
- ❌ Direct agent-to-agent method calls
- ❌ Mutating shared state without synchronization
- ❌ Throwing exceptions for expected failures
- ❌ Blocking operations without async
- ❌ Large methods - break into smaller private helpers
- ❌ Side effects in getters
- ❌ Exposing internal implementation details

## Copilot Trigger Phrases

Use these in comments to get specific patterns:

- "Following the pattern from ARCHITECTURE-DECISIONS.md" - References architecture doc
- "Use the subscription cleanup pattern" - Generates cleanup code
- "Implement with O(1) lookup using the index" - Uses Map/Set
- "Handle errors gracefully without crashing system" - Adds try-catch
- "Following the event publishing pattern" - Generates typed event
- "Validate agent implements IAgent interface" - Generates validation
- "Use Map for O(1) access" - Chooses efficient data structure
