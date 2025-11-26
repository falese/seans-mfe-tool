# Copilot Quick Reference

## 🚀 Quick Start

1. Open these files in tabs:
   - `.github/copilot-instructions.md`
   - The interface you're implementing
   - `docs/architecture-decisions.md`

2. For each method:
   - Write signature + detailed comment
   - Press Tab → Review → Accept/Refine

3. Keep types strict, comments specific

---

## 📝 Comment Triggers

| Want Copilot to... | Write this comment... |
|-------------------|----------------------|
| Use specific data structure | `// Use Map for O(1) lookup by agent ID` |
| Follow architecture | `// Following ADR-002: capability index pattern` |
| Handle errors gracefully | `// Wrap in try-catch - one agent failure shouldn't stop others` |
| Implement algorithm | `// Algorithm: 1. Step one 2. Step two 3. Step three` |
| Validate inputs | `// Validate: check agent exists, state is ready, capability is supported` |
| Publish event | `// Publish agent.registered event with capabilities payload` |

---

## 🎯 Method Implementation Template

```typescript
/**
 * [One-line description]
 * 
 * Implementation approach:
 * 1. [Specific step with data structure]
 * 2. [Specific step with condition]
 * 3. [Specific step with result]
 * 4. [Error handling approach]
 * 
 * @param [name] - [description]
 * @returns [description]
 * @throws [ErrorType] [when]
 */
async methodName(param: Type): Promise<ReturnType> {
  // Tab here → Copilot implements
}
```

---

## 🏗️ Architecture Quick Reference

### Data Structures
```typescript
// Agent registry - O(1) lookups
private registry: Map<string, AgentRegistryEntry>;

// Capability index - multiple agents per capability
private capabilityIndex: Map<string, Set<string>>;

// Subscriptions - cleanup on destroy
private subscriptions: (() => void)[];

// Event history - circular buffer
private eventHistory: AgentEvent[];
```

### State Validation
```typescript
// Validate state before operations
if (!this.registry.has(agentId)) {
  throw new AgentNotFoundError(agentId);
}
if (entry.state !== 'ready') {
  throw new InvalidStateError(agentId, entry.state);
}
```

### Error Isolation
```typescript
// Try-catch around agent operations
try {
  const result = await agent.execute(capability, params);
  return { success: true, result, agentId: agent.id };
} catch (error) {
  console.error(`Agent ${agent.id} failed:`, error);
  return { success: false, error: error.message, agentId: agent.id };
}
```

### Event Publishing
```typescript
this.eventBus.publish<PayloadType>({
  type: SystemEventTypes.EVENT_NAME,
  timestamp: new Date().toISOString(),
  source: this.id,
  payload: { /* typed data */ }
});
```

---

## 🧪 Test Template

```typescript
describe('ClassName', () => {
  let instance: ClassName;
  
  beforeEach(() => {
    // Setup
  });
  
  it('should [behavior]', async () => {
    // Arrange: setup test data
    // Act: call method
    // Assert: verify result
  });
});
```

---

## ⚡ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Accept suggestion | `Tab` |
| Reject suggestion | `Esc` |
| Next suggestion | `Alt + ]` |
| Previous suggestion | `Alt + [` |
| Open Copilot panel | `Ctrl + Enter` |
| Trigger inline suggestion | `Alt + \` |

---

## ✅ Quality Checklist

Before accepting Copilot's suggestion:

- [ ] No `any` types
- [ ] Error handling present
- [ ] Uses specified data structures
- [ ] Follows algorithm steps
- [ ] Proper TypeScript types
- [ ] Variable names are clear

---

## 🔧 When Copilot Gets Stuck

1. **Add more specific comments**
   ```typescript
   // Not specific enough:
   // Register the agent
   
   // Better:
   // Add agent to registry Map, update capability index Sets,
   // publish agent.registered event with capabilities payload
   ```

2. **Reference existing patterns**
   ```typescript
   // Following the subscription cleanup pattern from BaseAgent
   ```

3. **Open reference files**
   - Open file with similar pattern
   - Copilot uses nearby open files for context

4. **Break into smaller methods**
   ```typescript
   // Instead of one big method:
   private _validateManifest(manifest: AgentManifest): void { }
   private _createAgent(factory: AgentFactory): IAgent { }
   private _initializeAgent(agent: IAgent, config: AgentConfig): Promise<void> { }
   ```

---

## 📁 File Creation Order

1. **Types** (manual) - interfaces and type definitions
2. **EventBus** (Copilot) - simpler, good warmup
3. **Orchestrator** (Copilot) - core logic
4. **BaseAgent** (Copilot) - abstract base
5. **Concrete Agents** (Copilot shines) - logger, notifier, etc.
6. **Tests** (Copilot excellent) - comprehensive test suites

---

## 💡 Best Practices

**DO:**
- ✅ Write detailed JSDoc comments
- ✅ Specify data structures explicitly
- ✅ Reference ADRs in comments
- ✅ Keep interfaces open in tabs
- ✅ Review every suggestion
- ✅ Use strict TypeScript

**DON'T:**
- ❌ Blindly accept suggestions
- ❌ Use `any` type
- ❌ Skip error handling
- ❌ Write methods >50 lines
- ❌ Ignore type errors

---

## 🎓 Learning Pattern

Day 1: Types → EventBus → Tests
- Create all type definitions manually
- Implement EventBus with Copilot
- Write tests for EventBus

Day 2: Orchestrator Core
- Implement registration logic
- Add capability routing
- Test with mock agents

Day 3: Complete Orchestrator
- Add remaining lifecycle methods
- Implement module federation loading
- Comprehensive testing

Day 4-5: Agents
- Create BaseAgent abstract class
- Build concrete agent implementations
- End-to-end testing

---

## 📚 Full Documentation

- `.github/copilot-instructions.md` - Full Copilot configuration
- `.copilot/prompting-patterns.md` - Detailed prompt patterns
- `.copilot/workflow-guide.md` - Complete workflow instructions
- `.copilot/comment-templates.md` - Copy/paste templates
- `docs/architecture-decisions.md` - ADR reference

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Suggestions off-pattern | Add "Following ADR-XXX" comment |
| Type errors | Add explicit type parameters |
| Poor quality code | More specific algorithm steps |
| Copilot confused | Open reference file with correct pattern |
| Wrong data structure | Specify in comment: "Use Map for O(1)..." |

---

## 🎯 Success Metrics

Good session:
- ✅ 70%+ suggestions accepted
- ✅ Types compile without errors
- ✅ Tests pass after minimal fixes
- ✅ Following architecture patterns

Poor session:
- ⚠️ Rejecting most suggestions
- ⚠️ Fighting with Copilot
- ⚠️ Lots of `any` types

→ If poor, stop and refine your comments/architecture
