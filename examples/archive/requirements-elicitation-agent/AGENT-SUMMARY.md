# Requirements Elicitation Agent - Summary

## Overview

A specialized AI agent built with Claude Agent SDK to streamline requirements gathering for the MFE Platform. This agent combines interactive prompts, document analysis, and automated generation to create high-quality, well-structured requirements.

## Key Capabilities

### 1. Interactive Requirements Gathering
- **Guided Workflows**: Step-by-step prompts for complete requirement capture
- **Context-Aware**: Understands existing MFE platform structure
- **Quality Assurance**: Enforces Given-When-Then acceptance criteria
- **Multi-Category Support**: Handles runtime, BFF, DSL, handler, and feature requirements

### 2. Document Analysis
- **Existing Requirement Extraction**: Scans `docs/requirements/` for REQ-XXX patterns
- **ADR Analysis**: Identifies implicit requirements from architecture decisions
- **Gap Detection**: Finds missing or inconsistent requirements
- **Cross-Referencing**: Suggests related requirements automatically

### 3. Automated Document Generation
- **Markdown Requirements**: Formatted with metadata, rationale, and acceptance criteria
- **Gherkin Feature Files**: Test-ready scenarios in Given-When-Then format
- **Summary Reports**: Categorized by priority, status, and category
- **Traceability**: Cross-referenced links between related requirements

## Architecture

```
┌─────────────────────────────────────────────────────┐
│     Requirements Elicitation Agent                  │
│                                                      │
│  ┌────────────────┐  ┌──────────────────────────┐  │
│  │   Prompter     │  │   Doc Generator          │  │
│  │                │  │                          │  │
│  │ - Interactive  │  │ - Markdown formatting    │  │
│  │ - Categories   │  │ - Gherkin features       │  │
│  │ - GWT format   │  │ - Summary reports        │  │
│  │ - Validation   │  │ - Cross-referencing      │  │
│  └────────────────┘  └──────────────────────────┘  │
│           │                      │                  │
│           └──────────┬───────────┘                  │
│                      │                              │
│           ┌──────────▼──────────┐                   │
│           │  Claude Agent SDK   │                   │
│           │                     │                   │
│           │ - Context analysis  │                   │
│           │ - Requirement AI    │                   │
│           │ - Read/Grep tools   │                   │
│           └─────────────────────┘                   │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │   Project Context       │
        │                         │
        │ - 65+ requirements      │
        │ - MFE types             │
        │ - Capabilities          │
        │ - Platform handlers     │
        └─────────────────────────┘
```

## Modes of Operation

| Mode | Purpose | Use Case |
|------|---------|----------|
| **Interactive** | Gather new requirements via CLI prompts | Starting new features, adding capabilities |
| **Analyze** | Extract requirements from existing docs | Auditing, gap analysis, consistency checks |
| **Generate** | Create formatted documentation | Converting draft requirements to docs |
| **Comprehensive** | All three modes in sequence | Complete requirements session |

## Workflow

```
1. Context Gathering
   ├─ Scan docs/ directory
   ├─ Extract existing REQ-XXX IDs
   ├─ Load MFE platform knowledge
   └─ Build project context

2. Requirements Elicitation
   ├─ [Interactive] CLI prompts
   ├─ [Analyze] Document scanning
   ├─ AI-assisted refinement
   └─ Validation & consistency

3. Document Generation
   ├─ Format as markdown
   ├─ Generate Gherkin features
   ├─ Create summary reports
   └─ Cross-reference links

4. Session Persistence
   ├─ Save session metadata
   ├─ Store requirements JSON
   └─ Enable traceability
```

## Output Artifacts

### Requirement Documents
```markdown
# REQ-RUNTIME-012: Async lifecycle hooks

## Metadata
| Priority | Status | Category |
|----------|--------|----------|
| 🟠 HIGH  | ⚪ DRAFT | RUNTIME |

## Description
The lifecycle execution engine should support async hooks...

## Acceptance Criteria
GIVEN a hook returns a Promise
WHEN the lifecycle executes
THEN the engine awaits completion
```

### Feature Files
```gherkin
Feature: Async lifecycle hooks
  REQ-RUNTIME-012

  Scenario: Promise-based hooks
    Given a hook returns a Promise
    When the lifecycle executes
    Then the engine awaits completion
```

### Summary Reports
- Requirements grouped by category, priority, status
- Quick stats and counts
- Cross-referenced links
- Markdown formatted

## Integration Points

### With MFE Platform
- **Runtime System**: BaseMFE, lifecycle, context
- **GraphQL BFF**: Mesh config, handlers, transforms
- **DSL System**: Schema validation, type inference
- **Code Generation**: Templates, generators
- **Testing**: Jest, TDD workflow

### With Development Workflow
- **Pre-Planning**: Gather requirements before implementation
- **Design Phase**: Analyze ADRs for implicit requirements
- **Documentation**: Auto-generate requirement docs
- **Testing**: Create Gherkin scenarios for BDD

## Technology Stack

- **Claude Agent SDK**: AI-powered analysis and refinement
- **Inquirer**: Interactive CLI prompts
- **TypeScript**: Type-safe implementation
- **Node.js**: Runtime environment
- **Markdown/Gherkin**: Documentation formats

## Getting Started

```bash
# Install dependencies
cd agents/requirements-elicitation
npm install

# Build the agent
npm run build

# Run in interactive mode
npm run start:interactive

# Or use any mode
npm run start:analyze
npm run start:generate
npm run start:comprehensive
```

## Use Cases

### 1. New Feature Development
```bash
req-agent interactive
```
Interactively define requirements for a new MFE capability before writing code.

### 2. Requirements Audit
```bash
req-agent analyze
```
Analyze all existing docs to find gaps, inconsistencies, or missing requirements.

### 3. Documentation Backfill
```bash
req-agent generate
```
Convert existing draft requirements into properly formatted documentation.

### 4. Complete Requirements Session
```bash
req-agent comprehensive
```
Run full cycle: analyze existing → gather new → generate docs.

## Benefits

✅ **Consistency**: Enforces standard requirement format across the project
✅ **Traceability**: Links requirements to ADRs, code, and tests
✅ **Quality**: AI-assisted refinement ensures clarity and completeness
✅ **Efficiency**: Automates document generation and cross-referencing
✅ **Context-Aware**: Understands MFE platform structure and conventions
✅ **Test-Ready**: Generates Gherkin scenarios for BDD testing

## Example Requirements Generated

- **REQ-RUNTIME-XXX**: MFE lifecycle, context, handlers, error handling
- **REQ-BFF-XXX**: GraphQL Mesh, data sources, transforms, plugins
- **REQ-DSL-XXX**: Schema validation, type system, manifest processing
- **REQ-HANDLER-XXX**: Auth, validation, caching, rate limiting, telemetry
- **REQ-FEATURE-XXX**: Load, render, refresh, query, emit capabilities

## Future Enhancements

- Integration with issue tracking (Jira, Linear)
- AI-powered requirement quality scoring
- Automatic ADR generation from requirements
- Visual dependency graphs
- Multi-stakeholder collaboration
- Requirement versioning and history

## Metrics

**Agent Capabilities**:
- 4 operation modes
- 8+ requirement categories
- 7+ MFE types supported
- 6+ platform handlers recognized
- 7+ capabilities understood
- Given-When-Then format enforcement
- Cross-reference suggestion
- Gap analysis

**Output Quality**:
- Structured markdown documents
- Test-ready Gherkin scenarios
- Comprehensive summaries
- Full traceability

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Built with**: Claude Agent SDK + TypeScript
**Powered by**: Claude Sonnet 4.5
