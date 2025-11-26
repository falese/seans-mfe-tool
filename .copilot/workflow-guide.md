# Copilot Development Workflow

## The Iteration Pattern

Work in this cycle for each component:

```
1. Write interface/types → 
2. Write method signatures with detailed comments → 
3. Let Copilot implement → 
4. Review and refine → 
5. Write tests → 
6. Repeat
```

## Phase 1: Type Definitions (You Own This)

**What you do manually:**
- Define all interfaces
- Create type definitions
- Document contracts with JSDoc
- Specify relationships between types

**Why:** Types are your architecture. Copilot uses these as constraints. Good types = good suggestions.

**Files to create first:**
```
src/types/
├── agent.types.ts       # IAgent interface and related types
├── orchestrator.types.ts # IOrchestrator interface and registry types
├── eventbus.types.ts    # IEventBus and event types
└── index.ts             # Export all types
```

**Example workflow:**
```typescript
// 1. Start with the interface
export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  
  // 2. Add methods with full JSDoc
  /**
   * Initialize agent with configuration.
   * @param config - Agent-specific configuration object
   * @returns Promise that resolves when initialization completes
   */
  initialize(config: AgentConfig): Promise<void>;
  
  // 3. Continue for all methods
}

// 4. Add supporting types
export interface AgentConfig {
  [key: string]: unknown;
}
```

## Phase 2: Implementation Scaffolding (Copilot Assists)

**What you do:**
- Create class declaration
- Add constructor with dependencies
- Write method signatures
- Add detailed implementation comments

**What Copilot does:**
- Fills in field initializations
- Suggests helper methods
- Implements based on your comments

**Example workflow:**

1. **Create the file and imports:**
```typescript
import { IOrchestrator, AgentManifest, IEventBus } from '../types';

export class Orchestrator implements IOrchestrator {
```
(Copilot suggests the rest of the class structure)

2. **Add fields with descriptive comments:**
```typescript
export class Orchestrator implements IOrchestrator {
  // Map of agent ID to registry entry for O(1) lookup
  private registry: Map<string, AgentRegistryEntry>;
  
  // Index mapping capability name to Set of agent IDs that provide it
  private capabilityIndex: Map<string, Set<string>>;
  
  // Event bus for publishing system events
  private eventBus: IEventBus;
```
(Copilot understands the purpose of each field)

3. **Add constructor:**
```typescript
  constructor(eventBus: IEventBus) {
```
(Press Enter, Copilot suggests field initialization)

4. **For each method, write the signature and detailed comment:**
```typescript
  /**
   * Register an agent with the orchestrator.
   * 
   * Steps:
   * 1. Check if agent ID already exists in registry
   * 2. Call factory function to create agent instance
   * 3. Validate agent implements IAgent interface
   * 4. Initialize agent with config from manifest
   * 5. Get capabilities and add to capability index
   * 6. Add to registry with state 'ready'
   * 7. Publish agent.registered event
   * 
   * @throws AgentAlreadyExistsError if ID is taken
   */
  async registerAgent(manifest: AgentManifest, factory: AgentFactory): Promise<void> {
```
(Press Enter, Copilot implements based on steps)

## Phase 3: Review and Refine (Critical)

**Don't blindly accept.** Review each suggestion:

### ✅ Good Signs
- Uses the data structures you specified
- Follows the algorithm steps
- Proper error handling
- TypeScript is properly typed (no `any`)
- Reasonable variable names

### ⚠️ Warning Signs
- Using `any` type
- Missing error handling
- Not following your specified algorithm
- Mutating shared state unsafely
- Missing validation steps

### How to Refine

**If suggestion is 80% right:**
- Accept it
- Manually fix the issues
- The fixes teach Copilot for next suggestions

**If suggestion misses the mark:**
- Reject (Esc key)
- Add more specific comments
- Try again with Tab to cycle alternatives

**Example refinement:**
```typescript
// Copilot suggests:
const agents = this.registry.values();

// You refine to be more specific:
const agents = Array.from(this.registry.values())
  .filter(entry => entry.state === 'ready')
  .map(entry => entry.agent);
```

## Phase 4: Test-Driven Refinement

**Pattern:** Write test skeleton, let Copilot suggest test cases

1. **Create test file:**
```typescript
import { Orchestrator } from '../core/Orchestrator';
import { EventBus } from '../core/EventBus';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let eventBus: EventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
    orchestrator = new Orchestrator(eventBus);
  });
  
  describe('registerAgent', () => {
```
(Copilot suggests test cases)

2. **Accept and refine test suggestions:**
```typescript
    it('should register agent and add to registry', async () => {
      // Copilot will suggest arrange/act/assert
    });
    
    it('should throw error if agent ID already exists', async () => {
      // Copilot will suggest the test
    });
```

3. **Run tests, fix issues, iterate**

## Working Session Structure

### Start of Session (5-10 minutes)

1. Open key files in tabs:
   - The interface you're implementing
   - ARCHITECTURE.md
   - .github/copilot-instructions.md
   - Related implementation files

2. Review what you're building today

3. Add a session comment at top of file:
```typescript
/**
 * Today implementing: [feature]
 * Following patterns: [which patterns from architecture]
 * Dependencies: [what this needs]
 */
```

### During Implementation (Continuous)

**For each method:**
1. Write signature with parameters and return type
2. Write detailed JSDoc with implementation steps
3. Position cursor inside method body
4. Press Enter or Tab
5. Review Copilot's suggestion
6. Accept/refine/reject
7. Move to next method

**Keyboard shortcuts:**
- `Tab` - Accept suggestion
- `Esc` - Reject suggestion
- `Alt+]` - Next suggestion
- `Alt+[` - Previous suggestion
- `Ctrl+Enter` - Open Copilot panel for multiple suggestions

### When Copilot Gets Stuck

**Problem:** Copilot suggests wrong patterns

**Solutions:**
1. Open a reference file that has the right pattern
2. Add more explicit comments
3. Break the method into smaller pieces
4. Add an example in comments

**Example:**
```typescript
/**
 * Find agents by capability.
 * 
 * Use the capabilityIndex Map for O(1) lookup:
 * 1. Get Set of agent IDs from capabilityIndex.get(capability)
 * 2. For each ID, get agent from registry
 * 3. Filter to only agents in 'ready' state
 * 4. Return array of agent instances
 * 
 * Example flow:
 * capabilityIndex.get('data.fetch') -> Set(['agent1', 'agent2'])
 * -> [registry.get('agent1').agent, registry.get('agent2').agent]
 * -> filter where entry.state === 'ready'
 */
```

## File Organization Strategy

Create files in this order for best Copilot context:

1. **Types first** (no Copilot needed, pure architecture)
   - agent.types.ts
   - orchestrator.types.ts
   - eventbus.types.ts

2. **Core infrastructure** (Copilot with heavy guidance)
   - EventBus.ts (simpler, good warmup)
   - Orchestrator.ts (more complex)
   - BaseAgent.ts (abstract class)

3. **Concrete implementations** (Copilot shines here)
   - LoggerAgent.ts
   - NotifierAgent.ts
   - DataFetcherAgent.ts

4. **Tests** (Copilot excellent at generating)
   - EventBus.spec.ts
   - Orchestrator.spec.ts
   - Agent tests

5. **Integration** (Copilot helpful)
   - index.ts (orchestrator bootstrap)
   - Module federation config

## Multi-File Context

**Keep these files open simultaneously:**

When implementing Orchestrator:
```
✓ types/orchestrator.types.ts (the contract)
✓ types/eventbus.types.ts (events you'll publish)
✓ core/Orchestrator.ts (what you're writing)
✓ ARCHITECTURE.md (reference patterns)
```

When implementing an agent:
```
✓ types/agent.types.ts (the contract)
✓ core/BaseAgent.ts (base class to extend)
✓ agents/logger/LoggerAgent.ts (what you're writing)
✓ agents/notifier/NotifierAgent.ts (reference example)
```

## Common Iteration Patterns

### Pattern: Method is Too Complex

**Problem:** Copilot suggests 100+ line method

**Solution:**
```typescript
// Break into private helpers
async registerAgent(manifest: AgentManifest, factory: AgentFactory): Promise<void> {
  // High-level orchestration - Copilot will suggest helper calls
  this._validateManifest(manifest);
  const agent = await this._createAgent(factory);
  await this._initializeAgent(agent, manifest.config);
  this._registerCapabilities(agent);
  this._publishRegisteredEvent(agent);
}

// Implement each helper separately with detailed comments
private _validateManifest(manifest: AgentManifest): void {
  // Specific validation logic
}
```

### Pattern: Need Copilot to Use Specific Pattern

**Problem:** Copilot not following your architecture

**Solution:** Reference by name
```typescript
// Following the subscription cleanup pattern from BaseAgent
// Store unsubscribe functions in array for batch cleanup
private subscriptions: (() => void)[] = [];

subscribe(eventType: string, handler: EventHandler): () => void {
  // Copilot will follow the pattern
}
```

### Pattern: Type Errors

**Problem:** Copilot suggestion doesn't compile

**Solution:** Fix types first, then iterate
```typescript
// Before: Copilot suggests
const result = agent.execute(capability, params);

// Fix: Add type parameters
const result = await agent.execute<RequestType, ResponseType>(capability, params);
```

## Daily Workflow Example

**Day 1: Event Bus**
- [ ] Create types/eventbus.types.ts (manual)
- [ ] Create core/EventBus.ts with Copilot
- [ ] Write tests with Copilot
- [ ] Refine based on test failures

**Day 2: Orchestrator Core**
- [ ] Create types/orchestrator.types.ts (manual)
- [ ] Create core/Orchestrator.ts with Copilot
- [ ] Implement registerAgent with Copilot
- [ ] Test and refine

**Day 3: Complete Orchestrator**
- [ ] Implement remaining methods with Copilot
- [ ] Write comprehensive tests
- [ ] Refine error handling

**Day 4: Base Agent**
- [ ] Create core/BaseAgent.ts (abstract class)
- [ ] Implement common functionality
- [ ] Test with mock concrete agent

**Day 5: First Concrete Agent**
- [ ] Create agents/logger/LoggerAgent.ts
- [ ] Extend BaseAgent
- [ ] Copilot fills in specifics
- [ ] Test end-to-end

## Measuring Success

Good Copilot session indicators:
- ✅ Accepting 70%+ of suggestions with minor edits
- ✅ Type errors caught by TypeScript, not runtime
- ✅ Tests passing after minimal fixes
- ✅ Code follows architecture patterns
- ✅ Spending time on architecture, not boilerplate

Poor Copilot session indicators:
- ⚠️ Rejecting most suggestions
- ⚠️ Fighting with Copilot on patterns
- ⚠️ Lots of `any` types creeping in
- ⚠️ Suggestion quality degrading over time

**If session is poor:** Stop, refine your comments/architecture, restart
