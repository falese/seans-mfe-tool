# Example Implementation File

This is a complete example showing how to structure a file for maximum Copilot effectiveness. Use this as a template for your implementations.

## Example: EventBus.ts

```typescript
import {
  IEventBus,
  AgentEvent,
  EventHandler,
  Subscription,
} from '../types';

/**
 * In-memory event bus for inter-agent communication.
 * 
 * Features:
 * - Type-safe event publishing and subscription
 * - Pattern matching with wildcards (e.g., 'agent.*' matches all agent events)
 * - Event history for debugging and replay
 * - Automatic subscription cleanup
 * 
 * Architecture decisions:
 * - Following ADR-003: Support both exact and pattern matching
 * - Using Map for O(1) subscription lookups
 * - Circular buffer for event history to prevent unbounded growth
 * 
 * Dependencies:
 * - None (standalone component)
 */
export class EventBus implements IEventBus {
  // Map of exact event types to subscriptions
  // Key: event type string (e.g., 'agent.registered')
  // Value: Map of subscription ID to handler function
  // Allows O(1) lookup when publishing events
  private subscriptions: Map<string, Map<string, EventHandler<unknown>>>;
  
  // Map of event patterns to subscriptions
  // Key: pattern string (e.g., 'agent.*')
  // Value: Map of subscription ID to handler function
  // Separate from exact matches to avoid pattern overhead on common case
  private patternSubscriptions: Map<string, Map<string, EventHandler<unknown>>>;
  
  // Circular buffer of recent events for debugging
  // Maintains last N events, dropping oldest when full
  // Useful for replay and debugging agent communication
  private eventHistory: AgentEvent<unknown>[];
  
  // Maximum number of events to keep in history
  private readonly maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.subscriptions = new Map();
    this.patternSubscriptions = new Map();
    this.eventHistory = [];
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Publish an event to all matching subscribers.
   * 
   * Following ADR-003: Support pattern matching
   * 
   * Algorithm:
   * 1. Ensure event has timestamp (add if missing)
   * 2. Add event to history (manage circular buffer if at capacity)
   * 3. Find all exact match subscribers from subscriptions Map
   * 4. Find all pattern match subscribers by testing each pattern
   * 5. Call each handler function (wrap in try-catch to isolate handler errors)
   * 6. Log any handler errors but continue notifying other subscribers
   * 
   * Complexity: O(n) where n = number of subscriptions + patterns
   * 
   * @param event - Event to publish to subscribers
   */
  publish<T = unknown>(event: AgentEvent<T>): void {
    // Position cursor here and press Tab
    // Copilot will implement the 6 steps above
  }

  /**
   * Subscribe to exact event type match.
   * 
   * Following ADR-006: Return unsubscribe function for cleanup
   * 
   * Algorithm:
   * 1. Generate unique subscription ID (timestamp + random)
   * 2. Get or create handler map for this event type in subscriptions Map
   * 3. Add handler to the map with subscription ID as key
   * 4. Return unsubscribe function that removes this subscription by ID
   * 
   * Complexity: O(1)
   * 
   * @param eventType - Exact event type to subscribe to (e.g., 'agent.registered')
   * @param handler - Function to call when event is published
   * @returns Function to call to unsubscribe
   */
  subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): () => void {
    // Position cursor here and press Tab
    // Copilot will implement the 4 steps above
  }

  /**
   * Subscribe to pattern-matched events.
   * 
   * Following ADR-003: Pattern matching with wildcards
   * 
   * Pattern syntax:
   * - 'agent.*' matches 'agent.registered', 'agent.unregistered', etc.
   * - 'capability.*' matches 'capability.requested', 'capability.executed'
   * - Pattern converted to regex: 'agent.*' -> /^agent\..*/
   * 
   * Algorithm:
   * 1. Generate unique subscription ID
   * 2. Get or create handler map for this pattern in patternSubscriptions Map
   * 3. Add handler to the map with subscription ID as key
   * 4. Return unsubscribe function that removes this subscription
   * 
   * @param pattern - Event pattern with wildcards
   * @param handler - Function to call when matching event is published
   * @returns Function to call to unsubscribe
   */
  subscribePattern<T = unknown>(pattern: string, handler: EventHandler<T>): () => void {
    // Position cursor here and press Tab
  }

  /**
   * Get event history with optional filtering.
   * 
   * Algorithm:
   * 1. Start with copy of eventHistory array (don't expose internal array)
   * 2. If eventType provided, filter to only events with matching type
   * 3. If limit provided, slice to most recent N events
   * 4. Return filtered/limited array
   * 
   * Complexity: O(n) where n = history size
   * 
   * @param eventType - Optional event type filter
   * @param limit - Maximum number of events to return (most recent)
   * @returns Array of historical events matching criteria
   */
  getHistory<T = unknown>(eventType?: string, limit?: number): AgentEvent<T>[] {
    // Position cursor here and press Tab
  }

  /**
   * Clear all event history.
   * 
   * Use case: Reset state for testing or when history grows too large
   */
  clearHistory(): void {
    // Position cursor here and press Tab
  }

  /**
   * Get total count of active subscriptions.
   * 
   * Algorithm:
   * 1. Count all handlers in subscriptions Map (all nested Maps)
   * 2. Count all handlers in patternSubscriptions Map
   * 3. Return sum
   * 
   * Complexity: O(m) where m = number of unique event types/patterns
   * 
   * @returns Total number of active subscriptions
   */
  getSubscriptionCount(): number {
    // Position cursor here and press Tab
  }

  /**
   * Helper: Check if event type matches a pattern.
   * 
   * Pattern matching rules:
   * - Literal characters must match exactly
   * - '*' matches any sequence of characters
   * - Pattern 'agent.*' matches 'agent.registered', 'agent.anything'
   * 
   * Implementation:
   * 1. Escape special regex characters in pattern except '*'
   * 2. Replace '*' with '.*' (regex for "any characters")
   * 3. Wrap in '^' and '$' for full string match
   * 4. Test eventType against regex
   * 
   * Examples:
   * - matchesPattern('agent.registered', 'agent.*') -> true
   * - matchesPattern('capability.executed', 'agent.*') -> false
   * 
   * @param eventType - Event type to test
   * @param pattern - Pattern with wildcards
   * @returns True if event type matches pattern
   */
  private matchesPattern(eventType: string, pattern: string): boolean {
    // Position cursor here and press Tab
  }

  /**
   * Helper: Generate unique subscription ID.
   * 
   * Implementation:
   * - Use timestamp for uniqueness across time
   * - Use random number for uniqueness at same timestamp
   * - Format: 'sub_<timestamp>_<random>'
   * 
   * Example: 'sub_1699123456789_abc123'
   * 
   * @returns Unique subscription identifier
   */
  private generateSubscriptionId(): string {
    // Position cursor here and press Tab
  }
}
```

## Example: Test File

```typescript
import { EventBus } from '../core/EventBus';
import { AgentEvent, SystemEventTypes } from '../types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    // Setup: Create fresh EventBus instance for each test
    // Ensures tests are isolated and don't affect each other
    eventBus = new EventBus(100);
  });

  describe('publish', () => {
    it('should notify exact match subscribers', () => {
      // Arrange: Create mock handler and subscribe to specific event type
      const handler = jest.fn();
      eventBus.subscribe('agent.registered', handler);
      
      // Create test event
      const event: AgentEvent = {
        type: 'agent.registered',
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: { agentId: 'test-agent' }
      };

      // Act: Publish the event
      eventBus.publish(event);

      // Assert: Handler should be called once with the event
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should notify pattern match subscribers', () => {
      // Arrange: Subscribe to pattern 'agent.*'
      // Should match 'agent.registered', 'agent.unregistered', etc.
      const handler = jest.fn();
      eventBus.subscribePattern('agent.*', handler);

      // Create event that matches pattern
      const event: AgentEvent = {
        type: 'agent.registered',
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: {}
      };

      // Act: Publish matching event
      eventBus.publish(event);

      // Assert: Pattern subscriber should be notified
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should add event to history', () => {
      // Arrange: Create and publish event
      const event: AgentEvent = {
        type: 'test.event',
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: {}
      };

      // Act: Publish event
      eventBus.publish(event);

      // Assert: Event should be in history
      const history = eventBus.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(event);
    });

    it('should handle handler errors gracefully', () => {
      // Arrange: Create handler that throws error
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();
      
      // Subscribe both handlers
      eventBus.subscribe('test.event', errorHandler);
      eventBus.subscribe('test.event', successHandler);

      // Act: Publish event (should not throw)
      expect(() => {
        eventBus.publish({
          type: 'test.event',
          timestamp: new Date().toISOString(),
          source: 'test',
          payload: {}
        });
      }).not.toThrow();

      // Assert: Both handlers called despite error in first
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      // Arrange: Subscribe to event
      const handler = jest.fn();
      const unsubscribe = eventBus.subscribe('test.event', handler);

      // Act: Call unsubscribe
      unsubscribe();

      // Publish event after unsubscribing
      eventBus.publish({
        type: 'test.event',
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: {}
      });

      // Assert: Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should filter by event type', () => {
      // Arrange: Publish multiple event types
      eventBus.publish({
        type: 'agent.registered',
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: {}
      });
      eventBus.publish({
        type: 'capability.executed',
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: {}
      });

      // Act: Get history filtered to one type
      const history = eventBus.getHistory('agent.registered');

      // Assert: Should only have events of requested type
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('agent.registered');
    });

    it('should limit results', () => {
      // Arrange: Publish multiple events
      for (let i = 0; i < 10; i++) {
        eventBus.publish({
          type: 'test.event',
          timestamp: new Date().toISOString(),
          source: 'test',
          payload: { count: i }
        });
      }

      // Act: Get limited history
      const history = eventBus.getHistory(undefined, 5);

      // Assert: Should have exactly 5 most recent events
      expect(history).toHaveLength(5);
    });
  });

  // Copilot will generate more test cases based on the IEventBus interface
});
```

## Key Patterns Demonstrated

### 1. **File Header Comment**
- One-line description
- Feature list
- Architecture decisions (with ADR references)
- Dependencies

### 2. **Field Documentation**
Each field has:
- Purpose comment
- Data structure explanation
- Key/value type description
- Performance characteristics

### 3. **Method Documentation**
Each method has:
- One-line description
- ADR reference if applicable
- Algorithm steps (numbered and specific)
- Complexity analysis
- Parameter descriptions
- Return value description

### 4. **Implementation Hints**
Comments include:
- Specific data structures to use
- Error handling approach
- Edge cases to handle
- Examples of input/output

### 5. **Test Structure**
Tests follow:
- Arrange-Act-Assert pattern
- Descriptive test names
- Clear comments explaining setup
- Edge cases and error cases

## How to Use This Example

1. **Copy the structure** for your own classes
2. **Fill in the comments** with your specific details
3. **Position cursor** after each method comment
4. **Press Tab** - Copilot implements based on your comments
5. **Review and refine** - ensure it matches your algorithm
6. **Move to next method**

The key is: **specific comments = specific implementations**.
