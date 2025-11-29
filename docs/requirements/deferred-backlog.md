# Deferred/Future Backlog (as of Nov 29, 2025)

This file tracks requirements and features that are deferred or planned for future implementation. Each item should be linked to a GitHub issue for visibility and prioritization.

## Orchestration

- Service scaling (multiple instances)
- Load balancing/proxy features
- Plugin/extension architecture for custom orchestrators
- Service templates/blueprints
- Observability/monitoring integration
- Advanced inter-service communication (events, queues)
- Advanced deployment strategies (blue-green, canary)

## DSL Contract

- Authorization expression grammar (full boolean logic, resource binding)
- Advanced dependency resolution and validation
- Extended context object features (custom metadata, runtime hooks)

## Remote Generation

- Marker-aware regeneration (preserve user extensions below markers)
- Multiple bundler support (webpack, vite, etc.)
- Interactive capability wizard for CLI
- Shell DSL schema (separate requirements doc)

## Scaffolding

- E2E test templates (Playwright/Cypress)
- Visual regression test templates
- Performance/load test templates

---

**Instructions:**

- For each item, create or link a GitHub issue with label `type-feature` or `type-enhancement` and the appropriate component/requirement label.
- Update this file as items are implemented or re-prioritized.
- Reference this file in requirements docs and ADRs for traceability.
