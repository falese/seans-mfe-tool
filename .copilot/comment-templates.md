# Copilot Comment Templates

Copy these templates into your code. Fill in the bracketed sections, and Copilot will generate appropriate implementations.

## Class Header Template

```typescript
/**
 * [One-line description of what this class does]
 * 
 * Responsibilities:
 * - [Responsibility 1]
 * - [Responsibility 2]
 * - [Responsibility 3]
 * 
 * Design decisions:
 * - [Key decision 1 and why]
 * - [Key decision 2 and why]
 * 
 * Dependencies:
 * - [Dependency name]: [Why this class needs it]
 */
```

## Method Implementation Template

```typescript
/**
 * [One-line description of what this method does]
 * 
 * Implementation approach:
 * 1. [First step with specific detail]
 * 2. [Second step with specific detail]
 * 3. [Third step with specific detail]
 * 4. [Error handling approach]
 * 5. [Return value or side effect]
 * 
 * @param [paramName] - [What this parameter does]
 * @param [paramName2] - [What this parameter does]
 * @returns [What is returned and what it means]
 * @throws [ErrorType] [When this error is thrown]
 */
```

## Data Structure Declaration Template

```typescript
// Use [DataStructure] for [specific reason]
// Expected operations: [operation] is O([complexity]), [operation2] is O([complexity])
// Key: [key type and what it represents]
// Value: [value type and what it represents]
// Example: [show example key-value pair]
private [fieldName]: [DataStructure]<[KeyType], [ValueType]>;
```

## Algorithm Comment Template

```typescript
// Algorithm for [what this accomplishes]:
// Step 1: [Specific action with data structure]
// Step 2: [Specific action with condition]
// Step 3: [Specific action with result]
// Complexity: O([complexity]) where [n represents what]
```

## Error Handling Template

```typescript
// Error handling strategy for [operation]:
// - Try: [What operation to attempt]
// - Catch: [What errors to catch]
// - Log: [What context to log - agent ID, operation name, etc.]
// - Action: [Throw specific error | Return error object | Continue with fallback]
// - Cleanup: [What resources to clean up on error]
```

## Validation Template

```typescript
/**
 * Validate [what is being validated].
 * 
 * Validation checks:
 * - [Check 1]: [What's valid, what's invalid]
 * - [Check 2]: [What's valid, what's invalid]
 * - [Check 3]: [What's valid, what's invalid]
 * 
 * @throws [ErrorType] if [what condition causes this error]
 */
```

## Event Publishing Template

```typescript
// Publish [event.type] event to event bus
// Purpose: [Why this event is published - what other components need to know]
// Payload structure: [Describe what's in the payload]
// Consumers: [Who subscribes to this event]
this.eventBus.publish<[PayloadType]>({
  type: SystemEventTypes.[EVENT_NAME],
  timestamp: new Date().toISOString(),
  source: this.id,
  payload: {
    // Copilot will generate typed payload based on PayloadType
  },
  correlationId: [correlationId or undefined]
});
```

## Test Describe Block Template

```typescript
describe('[ClassName]', () => {
  // Test fixtures
  let [instanceName]: [ClassName];
  let [mockDepName]: jest.Mocked<[IDependency]>;
  
  beforeEach(() => {
    // Setup: Create mocks and initialize test instance
    // Copilot will generate mock creation and setup
  });
  
  describe('[methodName]', () => {
    it('should [expected behavior in normal case]', async () => {
      // Arrange: [What test data to setup]
      
      // Act: [What method to call with what params]
      
      // Assert: [What to verify about the result]
    });
    
    it('should [handle edge case]', async () => {
      // Copilot will generate edge case test
    });
    
    it('should throw [ErrorType] when [error condition]', async () => {
      // Copilot will generate error test
    });
  });
});
```

## Factory Method Template

```typescript
/**
 * Factory method for creating [what].
 * 
 * Handles:
 * - [Setup responsibility 1]
 * - [Setup responsibility 2]
 * - [Validation responsibility]
 * 
 * @param [param] - [What this configures]
 * @returns [What is created]
 */
static create[Something]([params]: [Type]): [ReturnType] {
  // Copilot will implement factory logic
}
```

## Abstract Method Template

```typescript
/**
 * [What this abstract method does].
 * 
 * Concrete implementations must:
 * - [Requirement 1]
 * - [Requirement 2]
 * - [Requirement 3]
 * 
 * @param [param] - [What this parameter means]
 * @returns [What subclasses should return]
 */
abstract [methodName]([param]: [Type]): [ReturnType];
```

## Helper Method Template

```typescript
/**
 * Helper: [What this helper does].
 * 
 * Used by: [Which methods call this helper]
 * Assumes: [What preconditions must be true]
 * 
 * @param [param] - [Parameter description]
 * @returns [Return value description]
 */
private _[helperName]([param]: [Type]): [ReturnType] {
  // Copilot will implement
}
```

## State Machine Comment Template

```typescript
/**
 * State transition: [CurrentState] -> [NewState]
 * 
 * Allowed when: [What conditions allow this transition]
 * Side effects:
 * - [What happens during transition]
 * - [What events are published]
 * - [What cleanup occurs]
 * 
 * Forbidden when: [What conditions prevent this transition]
 */
```

## Index/Registry Update Template

```typescript
// Update [index name] to reflect [what change]
// Operations:
// 1. [First update to which data structure]
// 2. [Second update to which data structure]
// 3. [Cleanup of stale entries]
// Maintains invariant: [What must remain true about the index]
```

## Async Coordination Template

```typescript
/**
 * [What this coordinates across multiple async operations]
 * 
 * Execution strategy:
 * - [Sequential | Parallel | Race | AllSettled]: [Why this strategy]
 * - Error handling: [How errors from any operation are handled]
 * - Timeout: [If applicable, what timeout and why]
 * - Cancellation: [If applicable, how to cancel]
 * 
 * @returns [What the combined result represents]
 */
```

---

## Complete Examples

### Example 1: Core Method

```typescript
/**
 * Execute a capability across all agents that provide it.
 * 
 * Implementation approach:
 * 1. Use capabilityIndex Map to find agent IDs that provide this capability (O(1))
 * 2. For each agent ID, get agent instance from registry
 * 3. Filter to only agents in 'ready' state (skip suspended/error)
 * 4. Execute capability on each agent in parallel using Promise.all
 * 5. Wrap each execution in try-catch to isolate agent failures
 * 6. Measure execution duration for each agent
 * 7. Publish capability.executed event for each attempt
 * 8. Return array of CapabilityResult with success/error for each agent
 * 
 * @param capability - Name of capability to execute (e.g., 'data.fetch')
 * @param params - Capability-specific parameters to pass to agent
 * @returns Promise resolving to array of results from each agent
 */
async executeCapability<T = unknown, R = unknown>(
  capability: string,
  params: T
): Promise<CapabilityResult<R>[]> {
  // Copilot will implement all 8 steps
}
```

### Example 2: Data Structure

```typescript
// Use Map of Sets for capability index
// Allows O(1) lookup: "which agents provide capability X?"
// Supports multiple agents providing same capability
// Key: capability name string (e.g., 'data.fetch')
// Value: Set of agent ID strings that provide this capability
// Example: capabilityIndex.get('data.fetch') -> Set(['agent-1', 'agent-2'])
private capabilityIndex: Map<string, Set<string>>;
```

### Example 3: Error Handling

```typescript
// Error handling strategy for agent initialization:
// - Try: Call agent.initialize() with config from manifest
// - Catch: Any error during initialization
// - Log: Error with agent ID, agent name, and error message
// - Action: Update registry entry state to 'error', do NOT throw (keep system running)
// - Cleanup: Remove partial registry entry and capability index entries
// - Event: Publish agent.error event with error details for monitoring
```

### Example 4: Test

```typescript
describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let eventBus: EventBus;
  let mockAgent: IAgent;
  
  beforeEach(() => {
    // Setup: Create event bus and orchestrator instances
    // Create mock agent that implements IAgent interface
    // Mock agent has id 'test-agent' and provides 'test.capability'
  });
  
  describe('executeCapability', () => {
    it('should execute capability on all agents that provide it', async () => {
      // Arrange: Register mock agent with test capability
      // Create test parameters for capability execution
      
      // Act: Call executeCapability with capability name and params
      
      // Assert: Verify result array has one entry
      // Assert: Verify result has success: true
      // Assert: Verify agent.execute was called with correct params
    });
    
    it('should handle agent execution errors gracefully', async () => {
      // Arrange: Register mock agent that throws error on execute
      
      // Act: Call executeCapability
      
      // Assert: Should return result with success: false
      // Assert: Should include error message in result
      // Assert: Should not throw exception
    });
  });
});
```

---

## Usage Tips

1. **Copy the template** that matches what you're implementing
2. **Fill in the bracketed placeholders** with your specific details
3. **Position cursor** after the comment block
4. **Press Enter or Tab** - Copilot will generate based on your template
5. **Review the suggestion** - Copilot follows the structure you specified
6. **Accept or refine** - Edit as needed, then move to next method

The more specific your template details, the better Copilot's suggestion will be.
