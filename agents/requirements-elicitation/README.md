# MFE Platform Requirements Elicitation Agent

An AI-powered agent built with the Claude Agent SDK to help gather, analyze, and document requirements for the MFE (Micro-Frontend) platform.

## Features

✨ **Interactive Requirements Gathering**
- Guided prompts for capturing requirements
- Given-When-Then acceptance criteria
- Priority and category classification
- Multi-requirement sessions

📖 **Document Analysis**
- Analyze existing documentation (REQ-XXX, ADRs)
- Extract implicit requirements
- Identify gaps and inconsistencies
- Cross-reference related requirements

📝 **Document Generation**
- Generate formatted requirement documents (markdown)
- Create Gherkin feature files for acceptance criteria
- Produce requirement summaries and reports
- Maintain consistency with existing docs

🔗 **Integration with Existing System**
- Aware of 65+ existing requirements
- Understands MFE types, capabilities, and handlers
- Follows established documentation patterns
- Suggests related requirements

## Installation

```bash
cd agents/requirements-elicitation
npm install
npm run build
```

Or install globally:

```bash
npm link
```

## Usage

### Run Modes

The agent supports four operation modes:

#### 1. Interactive Mode (Recommended for new requirements)

```bash
npm run start:interactive
# or if installed globally:
req-agent interactive
```

Launches an interactive CLI session that guides you through:
- Selecting requirement category (runtime, bff, dsl, handler, etc.)
- Choosing related area
- Entering title, description, and rationale
- Setting priority level
- Defining acceptance criteria (Given-When-Then format)

#### 2. Analyze Mode (Review existing docs)

```bash
npm run start:analyze
# or:
req-agent analyze
```

Analyzes your existing documentation to:
- Extract all existing requirements
- Identify implicit requirements in ADRs
- Find gaps in requirement coverage
- Suggest improvements and new requirements
- Cross-reference related requirements

#### 3. Generate Mode (Create formatted docs)

```bash
npm run start:generate
# or:
req-agent generate
```

Generates formatted documentation for requirements:
- Individual requirement markdown files
- Gherkin feature files for testing
- Requirements summary document
- Cross-referenced links

#### 4. Comprehensive Mode (All-in-one)

```bash
npm run start:comprehensive
# or:
req-agent comprehensive
```

Runs all three modes in sequence:
1. Analyzes existing documentation
2. Gathers new requirements interactively
3. Generates formatted documentation

### Programmatic Usage

```typescript
import RequirementsElicitationAgent from "./requirements-agent";

const agent = new RequirementsElicitationAgent("/path/to/project");

// Run interactive session
const session = await agent.elicitRequirements("interactive");

// Or analyze existing docs
const analysis = await agent.elicitRequirements("analyze");

// Access gathered requirements
console.log(session.requirements);
```

## Output

The agent generates documents in your project's `docs/` directory:

### Requirement Documents

Location: `docs/requirements/`

Format:
```markdown
# REQ-RUNTIME-001: Atomic Load Operation

## Metadata
| Property | Value |
|----------|-------|
| **ID** | REQ-RUNTIME-001 |
| **Priority** | 🔴 CRITICAL |
...

## Description
The system shall...

## Acceptance Criteria
### AC1
```gherkin
GIVEN the MFE is registered
WHEN load() is called
THEN entry → mount → enable-render executes atomically
```
...
```

### Feature Files

Location: `docs/acceptance-criteria/`

Format:
```gherkin
Feature: Atomic Load Operation
  REQ-RUNTIME-001

  Background:
    Given the MFE platform is running
    And all required dependencies are available

  Scenario: REQ-RUNTIME-001 - AC1
    Given the MFE is registered
    When load() is called
    Then entry → mount → enable-render executes atomically
```

### Session Files

Location: `docs/requirement-sessions/`

Contains JSON snapshots of each elicitation session with all gathered requirements.

## How It Works

### Architecture

```
RequirementsElicitationAgent
    │
    ├─── RequirementPrompter
    │    └─── Interactive CLI prompts (inquirer)
    │
    ├─── RequirementDocGenerator
    │    └─── Markdown & Gherkin generation
    │
    └─── Claude Agent SDK
         ├─── Document analysis
         ├─── Requirement refinement
         └─── Context gathering
```

### Workflow

1. **Context Gathering**
   - Scans `docs/` directory
   - Identifies existing requirements (REQ-XXX)
   - Extracts MFE types, capabilities, handlers
   - Builds project knowledge graph

2. **Requirements Elicitation**
   - Interactive prompts or document analysis
   - AI-assisted requirement refinement
   - Validation and consistency checks
   - Priority and categorization

3. **Document Generation**
   - Formats requirements as markdown
   - Creates Gherkin feature files
   - Generates summary reports
   - Links related requirements

4. **Session Persistence**
   - Saves session metadata
   - Preserves requirement history
   - Enables traceability

## Configuration

### Project Context

The agent automatically detects:
- **Existing Requirements**: From `docs/requirements/`
- **MFE Types**: `tool`, `agent`, `feature`, `service`, `remote`, `shell`, `bff`
- **Capabilities**: `load`, `render`, `refresh`, `query`, `emit`, `health`, `telemetry`
- **Platform Handlers**: `auth`, `validation`, `error-handling`, `caching`, `rate-limiting`, `telemetry`

### Requirement Categories

Supported categories:
- `runtime` → REQ-RUNTIME-XXX (MFE lifecycle, context, handlers)
- `bff` → REQ-BFF-XXX (GraphQL Mesh, data sources, transforms)
- `dsl` → REQ-DSL-XXX (Schema, types, validation)
- `handler` → REQ-HANDLER-XXX (Platform handlers)
- `feature` → REQ-FEATURE-XXX (Capabilities)
- `codegen` → REQ-CODEGEN-XXX (Templates, generation)
- `test` → REQ-TEST-XXX (Testing requirements)
- `deploy` → REQ-DEPLOY-XXX (Deployment, Docker, K8s)

### Acceptance Criteria Format

The agent encourages **Given-When-Then** format:

```gherkin
GIVEN [precondition]
WHEN [action]
THEN [expected outcome]
```

Example:
```gherkin
GIVEN the MFE manifest is valid
WHEN the generator processes the manifest
THEN a complete BFF server is generated with mesh.config.ts
```

## Examples

### Example Session

```bash
$ req-agent interactive

🔍 MFE Platform Requirements Elicitation Agent
============================================================

📊 Gathering project context...
Found 65 existing requirements

💬 Starting interactive requirements session...

? What category does this requirement belong to?
  ❯ Runtime Platform (REQ-RUNTIME-XXX)
    Backend for Frontend (REQ-BFF-XXX)
    DSL Contract (REQ-DSL-XXX)
    ...

? Which area does this requirement relate to?
  ❯ MFE Lifecycle (load/render/refresh)
    Context Management
    Platform Handlers
    ...

? Requirement title: Support for async lifecycle hooks

? Detailed description: [opens editor]
The lifecycle execution engine should support asynchronous
hook execution with proper error handling and timeout management...

? Rationale: [opens editor]
Modern MFEs often need to perform async operations during
lifecycle phases (API calls, resource loading, etc.)...

? Priority level:
  🔴 Critical
  ❯ 🟠 High
  🟡 Medium
  🟢 Low

📋 Acceptance Criteria (Given-When-Then format recommended)

? GIVEN: a lifecycle hook returns a Promise
? WHEN: the lifecycle phase executes
? THEN: the engine awaits the Promise before proceeding

✅ Created REQ-RUNTIME-012: Support for async lifecycle hooks

? Would you like to add another requirement? (Y/n)
```

### Example Output Files

**docs/requirements/req-runtime-012.md**
```markdown
# REQ-RUNTIME-012: Support for async lifecycle hooks

## Metadata
| Property | Value |
|----------|-------|
| **Priority** | 🟠 HIGH |
| **Status** | ⚪ DRAFT |
...
```

**docs/acceptance-criteria/req-runtime-012.feature**
```gherkin
Feature: Support for async lifecycle hooks
  REQ-RUNTIME-012

  Scenario: REQ-RUNTIME-012 - AC1
    Given a lifecycle hook returns a Promise
    When the lifecycle phase executes
    Then the engine awaits the Promise before proceeding
```

## Integration with MFE Platform

This agent is designed specifically for the `seans-mfe-tool` project and understands:

- **Runtime Platform**: BaseMFE, lifecycle phases, context flow
- **GraphQL BFF**: Mesh configuration, handlers, transforms
- **DSL System**: Zod schemas, manifest validation, type inference
- **Code Generation**: UnifiedGenerator, templates, EJS processing
- **Platform Handlers**: Auth, validation, error handling, telemetry
- **Testing**: Jest, TDD workflow, coverage requirements
- **Documentation**: ADRs, requirement docs, acceptance criteria

## Best Practices

1. **Be Specific**: Provide clear, testable descriptions
2. **Use GWT Format**: Structure acceptance criteria as Given-When-Then
3. **Link Requirements**: Reference related requirements for traceability
4. **Prioritize Properly**: Use priority levels consistently
5. **Iterate**: Run analyze mode periodically to identify gaps
6. **Version Control**: Commit generated docs alongside code changes

## Troubleshooting

### "No existing requirements found"

- Ensure you're running from the project root
- Check that `docs/requirements/` directory exists

### "Editor failed to open"

- Set `EDITOR` environment variable: `export EDITOR=vim`
- Or use quick mode to skip editor prompts

### "Module not found"

- Run `npm install` in the agent directory
- Rebuild with `npm run build`

## Development

### Project Structure

```
agents/requirements-elicitation/
├── requirements-agent.ts    # Main agent class
├── prompter.ts             # Interactive CLI prompts
├── doc-generator.ts        # Document formatting & generation
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
└── README.md               # This file
```

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

### Development Mode

```bash
npm run dev
```

## Roadmap

Future enhancements:
- [ ] Integration with Jira/Linear for ticket creation
- [ ] AI-powered requirement quality scoring
- [ ] Automatic ADR generation from requirements
- [ ] Visual requirement dependency graphs
- [ ] Export to other formats (PDF, Confluence, etc.)
- [ ] Multi-stakeholder collaboration mode
- [ ] Requirement versioning and history tracking

## License

MIT

## Contributing

This agent is part of the MFE Platform tooling. Contributions welcome!

---

**Built with Claude Agent SDK** | **Powered by Claude Sonnet 4.5**
