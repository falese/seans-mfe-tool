# Quick Start Guide - Requirements Elicitation Agent

Get started with the MFE Platform Requirements Elicitation Agent in under 5 minutes.

## Installation (1 minute)

```bash
cd agents/requirements-elicitation
npm install
npm run build
```

## Basic Usage (2 minutes)

### Option 1: Interactive Mode (Recommended)

```bash
npm run start:interactive
```

Follow the prompts to:
1. Choose requirement category
2. Enter title and description
3. Set priority
4. Define acceptance criteria

### Option 2: Analyze Existing Docs

```bash
npm run start:analyze
```

The agent will:
- Scan all documentation
- Extract existing requirements
- Identify gaps
- Suggest improvements

### Option 3: Do Everything

```bash
npm run start:comprehensive
```

Runs full workflow: analyze → gather → generate

## Quick Example (2 minutes)

```bash
$ npm run start:interactive

? What category does this requirement belong to?
  ❯ Runtime Platform (REQ-RUNTIME-XXX)

? Which area does this requirement relate to?
  ❯ MFE Lifecycle (load/render/refresh)

? Requirement title:
  Support for async lifecycle hooks

? Detailed description:
  The lifecycle execution engine should support
  asynchronous hook execution with proper error
  handling and timeout management.

? Rationale:
  Modern MFEs often need to perform async operations
  during lifecycle phases (API calls, resource loading).

? Priority level:
  ❯ 🟠 High

? GIVEN: a lifecycle hook returns a Promise
? WHEN: the lifecycle phase executes
? THEN: the engine awaits the Promise before proceeding

✅ Created REQ-RUNTIME-012: Support for async lifecycle hooks

? Add another requirement? No

💾 Session saved
📋 Total requirements: 1
```

## What You Get

After running the agent, you'll have:

📄 **docs/requirements/req-runtime-012.md**
```markdown
# REQ-RUNTIME-012: Support for async lifecycle hooks

## Metadata
| Property | Value |
|----------|-------|
| **Priority** | 🟠 HIGH |
...

## Description
The lifecycle execution engine should...

## Acceptance Criteria
GIVEN a lifecycle hook returns a Promise
WHEN the lifecycle phase executes
THEN the engine awaits the Promise
```

🥒 **docs/acceptance-criteria/req-runtime-012.feature**
```gherkin
Feature: Support for async lifecycle hooks
  REQ-RUNTIME-012

  Scenario: REQ-RUNTIME-012 - AC1
    Given a lifecycle hook returns a Promise
    When the lifecycle phase executes
    Then the engine awaits the Promise before proceeding
```

📊 **docs/requirements/REQUIREMENTS-SUMMARY.md**
- All requirements categorized
- Priority and status breakdowns
- Cross-referenced links

## Tips

💡 **Use Given-When-Then format** for acceptance criteria
- Clear preconditions (GIVEN)
- Specific actions (WHEN)
- Expected outcomes (THEN)

💡 **Reference related requirements** for traceability
- Agent suggests related REQ-XXX IDs
- Links are automatically created

💡 **Be specific** in descriptions
- What should the system do?
- Why is this needed?
- How will we test it?

💡 **Run analyze mode regularly** to maintain quality
- Finds gaps in coverage
- Ensures consistency
- Suggests improvements

## Modes Cheat Sheet

| Command | Mode | When to Use |
|---------|------|-------------|
| `npm run start:interactive` | Interactive | Adding new requirements |
| `npm run start:analyze` | Analyze | Auditing existing docs |
| `npm run start:generate` | Generate | Formatting drafts |
| `npm run start:comprehensive` | All-in-one | Complete session |

## Requirement Categories

Choose the right category:

- **runtime** → MFE lifecycle, context, handlers
- **bff** → GraphQL Mesh, data sources
- **dsl** → Schema validation, types
- **handler** → Platform handlers (auth, validation, etc.)
- **feature** → Capabilities (load, render, etc.)
- **codegen** → Templates, generators
- **test** → Testing requirements
- **deploy** → Deployment, Docker, K8s

## Troubleshooting

**"Module not found"**
```bash
npm install
```

**"No requirements found"**
- Ensure you're in project root
- Check `docs/requirements/` exists

**"Editor failed"**
```bash
export EDITOR=vim
```

## Next Steps

1. ✅ Run `npm run start:interactive`
2. ✅ Create your first requirement
3. ✅ Review generated docs
4. ✅ Commit to version control
5. ✅ Use Gherkin files for BDD tests

## Help

Need help? Check:
- [README.md](./README.md) - Full documentation
- [AGENT-SUMMARY.md](./AGENT-SUMMARY.md) - Architecture overview
- [example.ts](./example.ts) - Programmatic usage

---

**Ready?** Run `npm run start:interactive` and create your first requirement!
