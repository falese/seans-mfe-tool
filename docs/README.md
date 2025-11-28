# Agent System — seans-mfe-tool

This directory contains agent definitions for GitHub Copilot to perform specialized development tasks. Agents work together in a coordinated workflow to maintain code quality and traceability.

## Available Agents

### Requirements Elicitation Agent
**File:** `requirements-elicitation-agent.md`  
**Purpose:** Structured requirements gathering through iterative questioning, capturing architectural decisions, and managing GitHub Issues as the single source of truth for backlog.

**Key Capabilities:**
- Progressive questioning to elicit complete requirements
- ADR (Architecture Decision Record) creation
- **GitHub Issue Management** - Query, create, and sync issues dynamically
- Requirements document creation and updates
- Issue label standardization and traceability

**When to Use:**
- Beginning design for new features
- Exploring architectural implications
- Capturing requirements that span multiple components
- Querying project backlog ("What's high priority?")
- Planning sprints from GitHub Issues

### Implementation Developer Agent
**File:** `implementation-developer-agent.md`  
**Purpose:** Implements production features based on documented requirements and ADRs, following established patterns and integrating with existing infrastructure.

**Key Capabilities:**
- Feature implementation from requirements docs
- Template generation (EJS files)
- CLI command integration
- GWT (Given-When-Then) acceptance criteria generation
- Generated MFE test template creation
- GitHub Issue context tracking

**When to Use:**
- Implementing features after requirements are documented
- Building CLI commands from specifications
- Creating templates based on DSL contracts
- Wiring up orchestration components

### CodeGen TDD Guardian Agent
**File:** `codegen-tdd-guardian-agent.md`  
**Purpose:** Enforces 100% test coverage for all code generation capabilities through strict Test-Driven Development.

**Key Capabilities:**
- Test-first development (write tests before implementation)
- GWT scenario conversion to tests
- Snapshot testing for generated artifacts
- Coverage enforcement (pre-commit hooks, CI/CD)
- Flakiness detection (3x validation)
- GitHub Issue test status updates

**When to Use:**
- Creating new code generators
- Adding test coverage to existing generators
- Establishing TDD workflow for new features
- Refactoring generator logic

---

## Agent Workflow

### Typical Development Flow

```
1. Requirements Elicitation Agent
   ↓ (Creates requirements docs, ADRs, queries GitHub Issues)
   
2. User creates GitHub Issue
   ↓ (Requirements Agent updates docs with issue link)
   
3. Implementation Developer Agent
   ↓ (Implements feature, generates GWT scenarios, references issue)
   
4. CodeGen TDD Guardian Agent
   ↓ (Writes tests, achieves 100% coverage, updates issue)
   
5. Code Review → Merge → Issue Closed
   ↓
   
6. Requirements Elicitation Agent
   (Queries for closed issue, updates requirements doc: ✅ Complete)
```

### Agent Handoffs

**Requirements → Implementation:**
```
📥 Requirements Agent provides:
   - Requirements doc (REQ-XXX)
   - ADRs (ADR-NNN)
   - GitHub Issue number (#NNN)
   - Acceptance criteria files

📤 Implementation Agent receives:
   - Fetches issue details via GitHub tools
   - Implements per requirements
   - References issue in code comments
```

**Implementation → TDD Guardian:**
```
📥 Implementation Agent provides:
   - New/modified files to test
   - Functions requiring coverage
   - GWT acceptance criteria
   - GitHub Issue context

📤 TDD Guardian receives:
   - Writes test-first
   - Achieves 100% coverage
   - Suggests issue status update
```

---

## GitHub Issue Management (Primary Backlog System)

### Query Patterns

Use the Requirements Elicitation Agent with natural language:

```javascript
// Sprint planning
"Show me high priority open issues"
→ Queries GitHub, renders formatted table

// Component health
"What BFF issues are open?"
→ Filters by component-bff label

// Requirements coverage
"Issues related to REQ-BFF requirements"
→ Filters by req-bff label

// Recently updated
"What changed in the last week?"
→ Sorts by updated date
```

### Label System

All issues use standardized labels for filtering:

| Category | Labels |
|----------|--------|
| **Priority** | `priority-critical`, `priority-high`, `priority-medium`, `priority-low` |
| **Type** | `type-feature`, `type-bug`, `type-enhancement`, `type-docs`, `type-refactor` |
| **Component** | `component-cli`, `component-codegen`, `component-orchestration`, `component-bff`, `component-templates`, `component-build`, `component-deploy` |
| **Requirement** | `req-orchestration`, `req-bff`, `req-dsl`, `req-remote`, `req-scaffold` |

### Issue Templates

Located in `.github/ISSUE_TEMPLATE/`:
- `feature.yml` - New capabilities
- `requirement.yml` - Formal requirement tracking
- `bug.yml` - Defects

### Traceability

Every issue links to:
- **Requirements** (REQ-XXX in docs/\*-requirements.md)
- **ADRs** (ADR-NNN in docs/architecture-decisions.md)
- **Acceptance Criteria** (docs/acceptance-criteria/\*.feature)
- **Pull Requests** (when implemented)

---

## Using Agents

### Invoking an Agent

Reference the agent by name in your prompt:

```
"Use the Requirements Elicitation Agent to gather requirements for a new GraphQL caching feature"

"Have the Implementation Developer Agent implement REQ-BFF-001 through REQ-BFF-008"

"Use the TDD Guardian Agent to add coverage for src/codegen/DatabaseGenerator/"
```

### Agent Limitations

Each agent has **clear boundaries** (see "Edges It Won't Cross" in each definition):

- Requirements Agent: Doesn't implement code, doesn't make architectural decisions independently
- Implementation Agent: Doesn't design features, doesn't skip tests, follows documented contracts
- TDD Guardian: Doesn't implement features, doesn't compromise on 100% coverage

### Multi-Agent Sessions

For complex work, agents hand off:

```
User: "I want to add TypeScript template support"

1. Requirements Agent:
   - Gathers requirements through questions
   - Creates REQ-SCAFFOLD-007
   - Writes ADR-047 (TypeScript vs Babel)
   - Queries GitHub for related issues
   - Drafts issue description

2. User creates GitHub Issue #50

3. Implementation Agent:
   - Fetches issue #50 details
   - Implements TS templates
   - Generates GWT scenarios
   - Creates test templates for generated TS projects

4. TDD Guardian:
   - Writes tests first
   - Achieves 100% coverage
   - Suggests updating issue #50

5. User merges PR, closes issue

6. Requirements Agent (on request):
   - Queries for closed issue #50
   - Updates REQ-SCAFFOLD-007: ✅ Complete
```

---

## Best Practices

### Start with Requirements
Always begin with the Requirements Elicitation Agent before implementing. Clear requirements prevent rework.

### Query Before Creating
Use the Requirements Agent to query GitHub Issues before creating new ones to avoid duplicates.

### Maintain Traceability
Every implementation should reference:
- REQ-XXX in code comments
- Issue #NNN in commit messages
- ADR-NNN in architectural code

### Update Issues Actively
When agents suggest issue updates, do it promptly to keep the team informed.

### Test First
Use the TDD Guardian before or during implementation, never after. Tests guide design.

### Review Agent Outputs
Agents are assistants, not replacements. Review and validate all outputs, especially:
- Requirements docs (completeness)
- ADRs (architectural soundness)
- Issue descriptions (clarity)
- Generated code (correctness, security)

---

## Troubleshooting

### Agent Not Understanding Context
- Provide explicit file paths or requirement numbers
- Reference specific ADRs or GitHub issues
- Include relevant code snippets in the prompt

### Agent Doing Too Much
- Remind agent of its boundaries ("Don't implement, just document requirements")
- Reference the "Edges It Won't Cross" section
- Break work into smaller tasks

### Agent Not Using GitHub Tools
- Explicitly request: "Query GitHub Issues for..."
- Mention labels: "Find all priority-high component-bff issues"
- The Requirements Agent has GitHub tools, others don't (handoff through Requirements Agent)

### Synchronization Issues
- GitHub Issues are always authoritative
- If requirements doc conflicts with issue, update requirements doc
- Use Requirements Agent to query current issue status

---

## Migration Notes

### From BACKLOG.md (Deprecated 2025-11-28)

`docs/BACKLOG.md` is now historical reference only. All active backlog is in GitHub Issues.

**Why the change:**
- ✅ No manual sync required
- ✅ Real-time collaboration
- ✅ Rich metadata (labels, assignees, milestones)
- ✅ Automation-ready (GitHub Actions)

**How to migrate:**
1. Query existing issues via Requirements Elicitation Agent
2. Create missing issues using templates
3. Update requirements docs with issue links
4. Archive BACKLOG.md (keep for history)

---

## Contributing

### Adding a New Agent

1. Create `[agent-name]-agent.md` in this directory
2. Use the chatagent format with YAML frontmatter:
   ```markdown
   ```chatagent
   ---
   description: 'Brief one-line description'
   tools: ['edit', 'search', 'runCommands']
   ---
   
   # Agent Name
   
   ## Purpose
   [Clear explanation of agent's role]
   
   ## When to Use
   [Specific scenarios]
   
   ## Edges It Won't Cross
   [Clear boundaries]
   ```
3. Update this README with agent description
4. Test with sample prompts
5. Document handoff protocols with existing agents

### Updating Existing Agents

When modifying agents:
- Preserve "Edges It Won't Cross" clarity
- Update "Tools Used" section if adding capabilities
- Test handoff protocols still work
- Update this README if workflow changes
- Consider impact on other agents (handoffs)

---

## Additional Resources

- **Main Copilot Instructions:** `.github/copilot-instructions.md` - Project-wide guidance
- **GitHub Issue Templates:** `.github/ISSUE_TEMPLATE/` - Standardized issue creation
- **Requirements Docs:** `docs/*-requirements.md` - Source of truth for features
- **ADRs:** `docs/architecture-decisions.md` - Architectural decisions
- **Acceptance Criteria:** `docs/acceptance-criteria/*.feature` - GWT scenarios
- **Live Backlog:** [GitHub Issues](https://github.com/falese/seans-mfe-tool/issues)
