# GitHub Copilot Prompting Patterns

## How to Use This Guide

These are proven prompt patterns for getting high-quality code from Copilot in this project. Copy the pattern into your file and Copilot will generate appropriate implementations.

## Pattern 1: Interface Implementation

**When to use:** Starting a new class that implements an interface

**Pattern:**
```typescript
import { IInterfaceName } from '../types';

/**
 * Brief description of this implementation.
 * 
 * This implementation follows [specific approach]:
 * - Key design decision 1
 * - Key design decision 2
 * - Key design decision 3
 */
export class ClassName implements IInterfaceName {
  // Private fields for internal state
  private fieldName: Map<string, Type>;
  
  constructor(dependencies: Deps) {
    // Copilot will initialize fields
  }

  // Copilot will generate all interface methods
}
```

**Example:**
```typescript
import { IEventBus, AgentEvent, EventHandler } from '../types';

/**
 * In-memory event bus for inter-agent communication.
 * 
 * This implementation uses:
 * - Map for O(1) subscription lookups
 * - Circular buffer for event history
 * - Regex for wildcard pattern matching
 */
export class EventBus implements IEventBus {
  private subscriptions: Map<string, Map<string, EventHandler>>;
  private eventHistory: AgentEvent[];
  
  // Copilot will generate: publish, subscribe, getHistory, etc.
}
```

## Pattern 2: Method Implementation with Algorithm Steps

**When to use:** Implementing a complex method

**Pattern:**
```typescript
/**
 * One-line description of what this method does.
 * 
 * Algorithm:
 * 1. First step with specific action
 * 2. Second step with specific action
 * 3. Third step with specific action
 * 4. Error handling approach
 * 5. What to return
 * 
 * Complexity: O(n) where n is [description]
 */
async methodName(param: Type): Promise<ReturnType> {
  // Copilot implements based on algorithm steps
}
```

**Example:**
```typescript
/**
 * Register an agent with the orchestrator.
 * 
 * Algorithm:
 * 1. Validate agent doesn't already exist in registry
 * 2. Create agent instance by calling factory function
 * 3. Verify agent implements all IAgent methods
 * 4. Call agent.initialize() with config from manifest
 * 5. Get capabilities and update capability index
 * 6. Add to registry with state 'ready'
 * 7. Publish 'agent.registered' event on event bus
 * 
 * @throws AgentAlreadyExistsError if agent ID is taken
 */
async registerAgent(manifest: AgentManifest, factory: AgentFactory): Promise<void> {
  // Copilot will implement all 7 steps
}
```

## Pattern 3: Data Structure Selection

**When to use:** Need Copilot to choose the right data structure

**Pattern:**
```typescript
// Use [Data Structure] for [reason]
// Expected operations: [operations with Big-O]
// Key: [key type and meaning], Value: [value type and meaning]
private dataStructureName: DataStructure<K, V>;
```

**Examples:**
```typescript
// Use Map for O(1) agent lookup by ID
// Expected operations: get O(1), set O(1), delete O(1), has O(1)
// Key: agentId string, Value: AgentRegistryEntry
private registry: Map<string, AgentRegistryEntry>;

// Use Map of Sets for capability to agents index
// Allows multiple agents to provide same capability with O(1) lookup
// Key: capability name, Value: Set of agent IDs
private capabilityIndex: Map<string, Set<string>>;

// Use array for event history with circular buffer behavior
// Maintains last N events for debugging and replay
// Oldest events dropped when max size reached
private eventHistory: AgentEvent[];
```

## Pattern 4: Error Handling Strategy

**When to use:** Defining how errors should be handled

**Pattern:**
```typescript
// Error handling strategy:
// - Wrap in try-catch to prevent [what from crashing]
// - Log error with [what context information]
// - [How to handle failure - throw, return error object, continue]
// - [What cleanup is needed on error]
```

**Example:**
```typescript
async executeCapability<T, R>(capability: string, params: T): Promise<CapabilityResult<R>[]> {
  const agents = this.findAgentsByCapability(capability);
  const results: CapabilityResult<R>[] = [];

  // Error handling strategy:
  // - Execute each agent in try-catch - one agent failure shouldn't stop others
  // - Log errors with agent ID and capability name for debugging
  // - Include error in result object with success: false
  // - Continue processing remaining agents even if one fails
  
  for (const agent of agents) {
    // Copilot will implement with proper error handling
  }
  
  return results;
}
```

## Pattern 5: Type-Safe Event Publishing

**When to use:** Publishing events to the event bus

**Pattern:**
```typescript
// Publish [event type] event
// Payload: [describe payload structure]
// Purpose: [why this event is published]
this.eventBus.publish<PayloadType>({
  type: SystemEventTypes.EVENT_NAME,
  timestamp: new Date().toISOString(),
  source: this.id,
  payload: {
    // Copilot will generate typed payload
  },
  correlationId: context?.correlationId
});
```

**Example:**
```typescript
// Publish agent.registered event
// Payload: agent metadata and capabilities for other agents to discover
// Purpose: notify system that new agent is available
this.eventBus.publish<SystemEvents.AgentRegisteredPayload>({
  type: SystemEventTypes.AGENT_REGISTERED,
  timestamp: new Date().toISOString(),
  source: 'orchestrator',
  payload: {
    agentId: agent.id,
    name: agent.name,
    version: agent.version,
    capabilities: capabilities.map(c => c.name)
  }
});
```

## Pattern 6: Test Case Generation

**When to use:** Writing tests for a class

**Pattern:**
```typescript
describe('ClassName', () => {
  // Test fixtures and setup
  let instance: ClassName;
  let mockDep: jest.Mocked<IDependency>;

  beforeEach(() => {
    // Setup mocks and create instance
  });

  describe('methodName', () => {
    it('should [expected behavior in normal case]', async () => {
      // Arrange: setup test data
      
      // Act: call the method
      
      // Assert: verify expected results
    });

    it('should [handle specific edge case]', async () => {
      // Test edge case
    });

    it('should [handle error case]', async () => {
      // Test error handling
    });
  });

  // Copilot will generate more test cases based on interface
});
```

## Pattern 7: Validation Logic

**When to use:** Need to validate input or state

**Pattern:**
```typescript
/**
 * Validate [what is being validated].
 * 
 * Checks:
 * - [Check 1 with what happens if it fails]
 * - [Check 2 with what happens if it fails]
 * - [Check 3 with what happens if it fails]
 * 
 * @throws [ErrorType] if validation fails
 */
private validateSomething(input: Type): void {
  // Copilot will implement all checks
}
```

**Example:**
```typescript
/**
 * Validate agent implements required IAgent interface.
 * 
 * Checks:
 * - Has required properties: id, name, version
 * - Has required methods: initialize, getCapabilities, execute, subscribe, cleanup
 * - Methods have correct signatures
 * 
 * @throws InvalidAgentError if validation fails
 */
private validateAgentInterface(agent: unknown): asserts agent is IAgent {
  // Copilot will implement validation checks
}
```

## Pattern 8: Dependency Injection Setup

**When to use:** Class needs dependencies

**Pattern:**
```typescript
/**
 * Class description.
 * 
 * Dependencies:
 * - [Dependency 1]: [why it's needed]
 * - [Dependency 2]: [why it's needed]
 */
export class ClassName {
  constructor(
    private readonly dep1: IDep1,
    private readonly dep2: IDep2
  ) {
    // Copilot will initialize if needed
  }
}
```

## Pattern 9: Factory Pattern

**When to use:** Creating instances with complex setup

**Pattern:**
```typescript
/**
 * Factory for creating [what].
 * 
 * Handles:
 * - [Setup step 1]
 * - [Setup step 2]
 * - [Setup step 3]
 */
export class SomethingFactory {
  static create(config: Config): Something {
    // Copilot will implement creation logic
  }
}
```

## Pattern 10: Abstract Base Class

**When to use:** Common functionality across implementations

**Pattern:**
```typescript
/**
 * Base implementation providing common functionality for [what].
 * 
 * Concrete classes must implement:
 * - [method1]: [what it does]
 * - [method2]: [what it does]
 * 
 * Base class provides:
 * - [functionality1]
 * - [functionality2]
 */
export abstract class BaseClassName implements IInterface {
  // Common fields
  
  constructor(commonParams: Params) {
    // Common initialization
  }
  
  // Concrete methods with common logic
  
  // Abstract methods that subclasses must implement
  abstract methodName(): ReturnType;
}
```

## Tips for Better Copilot Suggestions

1. **Be specific in step-by-step algorithms** - "Find agent" vs "Look up agent in registry Map by ID"

2. **Reference existing patterns** - "Following the subscription cleanup pattern" makes Copilot use established code

3. **Specify data structures** - "Use Map for O(1) lookup" vs just "store agents"

4. **Include error handling intent** - "Wrap in try-catch to prevent one agent from crashing system"

5. **Type everything explicitly** - Copilot generates better code with strong types

6. **Keep interfaces open** - Having the interface file open when implementing helps tremendously

7. **Use examples** - "Similar to how EventBus handles subscriptions" helps Copilot understand

8. **Comment the "why"** - "Using Set to ensure no duplicate subscriptions" tells Copilot your reasoning
