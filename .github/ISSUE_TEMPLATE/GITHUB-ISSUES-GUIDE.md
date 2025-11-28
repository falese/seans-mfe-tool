# GitHub Issues Management Guide

This guide explains how to use GitHub Issues as the primary backlog system with the Requirements Elicitation Agent.

## Quick Start

### Query Your Backlog

```
You: "Show me the current backlog"

Agent uses:
- github-pull-request_formSearchQuery("all open issues")
- github-pull-request_doSearch(query)
- github-pull-request_renderIssues(results)

Result: Formatted table of all open issues with links
```

### Find High Priority Work

```
You: "What are the high priority items?"

Agent: [Queries and displays]
📊 Found 5 high-priority issues:
- #45: BFF Layer Code Generation (component-bff)
- #52: Module Federation Singleton Violations (component-build)
- #38: Troubleshooting Documentation (component-docs)
...
```

### Check Component Status

```
You: "How's the orchestration component doing?"

Agent: [Queries component-orchestration label]
🔍 Orchestration Component Status:
- Total: 10 issues (3 closed, 7 open)
- Priority breakdown: 2 high, 4 medium, 1 low
- Recent activity: #19 updated 2 days ago
- Blockers: None
```

### Requirements Coverage Check

```
You: "Are all BFF requirements tracked in issues?"

Agent: [Queries req-bff label and cross-references requirements doc]
✅ BFF Requirements Coverage:
- REQ-BFF-001 to REQ-BFF-008: Issue #45 (OPEN)
- All requirements have tracking issues
- 1 in progress, 0 blocked
```

---

## Common Query Patterns

### By Priority

| Query                | GitHub Search Syntax                          |
| -------------------- | --------------------------------------------- |
| "Critical issues"    | `is:issue state:open label:priority-critical` |
| "High priority open" | `is:issue state:open label:priority-high`     |
| "All priorities"     | `is:issue state:open label:priority-*`        |

### By Component

| Query                     | GitHub Search Syntax                                |
| ------------------------- | --------------------------------------------------- |
| "CLI issues"              | `is:issue label:component-cli`                      |
| "Codegen bugs"            | `is:issue label:component-codegen label:type-bug`   |
| "Open orchestration work" | `is:issue state:open label:component-orchestration` |

### By Type

| Query                 | GitHub Search Syntax                     |
| --------------------- | ---------------------------------------- |
| "All bugs"            | `is:issue label:type-bug`                |
| "Feature requests"    | `is:issue label:type-feature state:open` |
| "Documentation needs" | `is:issue label:type-docs state:open`    |

### By Requirement

| Query                        | GitHub Search Syntax               |
| ---------------------------- | ---------------------------------- |
| "Orchestration requirements" | `is:issue label:req-orchestration` |
| "BFF issues"                 | `is:issue label:req-bff`           |
| "DSL contract work"          | `is:issue label:req-dsl`           |

### Combined Queries

| Query                    | GitHub Search Syntax                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| "High priority BFF bugs" | `is:issue state:open label:priority-high label:component-bff label:type-bug` |
| "Recent CLI features"    | `is:issue label:component-cli label:type-feature sort:updated-desc`          |
| "Blocked work"           | `is:issue state:open label:status-blocked`                                   |

### Time-Based

| Query              | GitHub Search Syntax                      |
| ------------------ | ----------------------------------------- |
| "Recently updated" | `is:issue state:open sort:updated-desc`   |
| "Recently closed"  | `is:issue state:closed sort:updated-desc` |
| "Stale issues"     | `is:issue state:open updated:<2025-11-01` |

---

## Creating Issues from Requirements

### Step-by-Step Workflow

1. **Elicit Requirements** (Requirements Agent)

   ```
   You: "Let's plan support for Redis caching in the BFF layer"

   Agent:
   - Asks clarifying questions
   - Documents in docs/graphql-bff-requirements.md
   - Creates ADR-048 (Redis vs in-memory)
   - Generates acceptance criteria
   ```

2. **Check for Duplicates**

   ```
   You: "Are there existing issues about caching?"

   Agent: [Queries]
   🔍 Found 1 related issue:
   - #60: Response caching for GraphQL queries (CLOSED)

   No conflicts found. Ready to create new issue.
   ```

3. **Draft Issue Description**

   ```
   Agent: "I'll draft the issue description:"

   ---
   ## Requirements Reference
   - **REQ-BFF-009**: Redis Caching Layer

   ## Architecture Decision
   - **ADR-048**: Redis for distributed caching

   ## Acceptance Criteria
   See: docs/acceptance-criteria/bff-caching.feature
   - [ ] Redis connection configuration
   - [ ] Cache key strategy (query hash)
   - [ ] TTL configuration per operation type
   - [ ] Cache invalidation on mutation

   ## Implementation Notes
   - Dependencies: ioredis, @graphql-mesh/plugin-response-cache
   - Follows pattern: src/templates/bff/server.ts.ejs
   - Requires Docker Compose update (Redis service)

   ## Definition of Done
   - [ ] Implementation complete per REQ-BFF-009
   - [ ] Tests pass (100% coverage)
   - [ ] Documentation updated
   - [ ] Redis deployment config included
   ---

   📋 Ready to create issue with these labels:
   - priority-medium
   - component-bff
   - type-enhancement
   - req-bff

   Please create issue in GitHub and provide the number.
   ```

4. **User Creates Issue** (in GitHub UI)

   - Copy description from agent
   - Apply suggested labels
   - Assign milestone if applicable
   - Get issue number (e.g., #65)

5. **Link Issue to Requirements**

   ```
   You: "Created as issue #65"

   Agent: "Updating requirements document..."

   ## REQ-BFF-009: Redis Caching Layer
   **Status:** 🟡 In Progress
   **GitHub Issue:** #65
   **Assigned To:** @dev-team
   **Created:** 2025-11-28

   [rest of requirement documentation]
   ```

---

## Tracking Implementation Progress

### Querying Issue Status

```
You: "What's the status of issue #65?"

Agent: [Fetches issue details]
📊 Issue #65: Redis Caching for BFF Layer
- **Status:** OPEN
- **Priority:** medium
- **Component:** bff
- **Assigned:** @dev-team
- **Last Updated:** 2 hours ago
- **Comments:** 3
- **Related PRs:** PR #66 (draft)
- **Labels:** priority-medium, component-bff, type-enhancement, req-bff

💬 Recent Activity:
- @dev-team: "Redis connection pooling implemented"
- @dev-team: "Working on cache key strategy"
- @reviewer: "Looks good, add TTL docs"
```

### Sprint Progress

```
You: "How's sprint 5 looking?"

Agent: [Queries milestone:"Sprint 5"]
📈 Sprint 5 Progress:
- Total: 12 issues
- Closed: 7 (58%)
- In Progress: 3 (25%)
- Open: 2 (17%)

🎯 On Track to Complete:
- #45: BFF Layer (95% - in review)
- #52: Singleton Violations (80% - testing)

⚠️ At Risk:
- #60: TypeScript Templates (50% - blocked by #52)
```

### Component Health Dashboard

```
You: "Give me a component health report"

Agent: [Queries all components]
📊 Component Health Report:

CLI (component-cli)
- 8 open, 12 closed (60% complete)
- 2 high priority
- Last activity: 1 day ago
- Status: ✅ Healthy

Codegen (component-codegen)
- 6 open, 10 closed (63% complete)
- 1 critical (blocker!)
- Last activity: 3 hours ago
- Status: ⚠️ Attention Needed

Orchestration (component-orchestration)
- 10 open, 5 closed (33% complete)
- 3 high priority
- Last activity: 1 week ago
- Status: ⚠️ Stale

BFF (component-bff)
- 3 open, 2 closed (40% complete)
- 1 high priority
- Last activity: 2 hours ago
- Status: ✅ Active Development
```

---

## Synchronizing Issues with Requirements

### When Issue is Created

Requirements Agent updates the requirements document:

```markdown
## REQ-BFF-009: Redis Caching Layer

**Status:** 🟡 In Progress
**GitHub Issue:** #65
**Created:** 2025-11-28
```

### When Issue is Updated

Query periodically or on notification:

```
You: "Any updates on issue #65?"

Agent: [Fetches latest]
📬 Issue #65 Updates:
- New comment from @dev-team (5 min ago)
- Status: Still OPEN
- PR #66 linked (ready for review)
- 2 approvals needed
```

### When Issue is Closed

```
You: "Check if any BFF issues were closed recently"

Agent: [Queries recently closed req-bff issues]
✅ Issue #65 CLOSED (2025-11-29)
- Merged: PR #66
- Tests: 100% coverage
- Reviewer: @tech-lead

Updating requirements document...

## REQ-BFF-009: Redis Caching Layer
**Status:** ✅ Complete
**GitHub Issue:** #65 (Closed 2025-11-29)
**Implemented in:** PR #66
**Implementation Notes:**
- Uses ioredis with connection pooling
- Cache keys: SHA256 of query + variables
- Default TTL: 5 minutes (configurable)
- Invalidation on mutation: tag-based strategy
**Lessons Learned:**
- Redis cluster setup needed for production
- Cache warming on deploy reduces cold start
```

### When Requirements Change

```
You: "REQ-BFF-009 scope expanded - need cache warming"

Agent: [Queries related issues]
⚠️ Requirements changed for REQ-BFF-009

Related issues:
- #65: Redis Caching (CLOSED)

Recommended actions:
1. Create new issue for cache warming feature
2. Reference #65 as "related to"
3. Update REQ-BFF-009 with new acceptance criteria

Shall I draft the new issue description?
```

---

## Advanced Queries

### Find Blockers and Dependencies

```
You: "What's blocking progress?"

Agent: [Queries critical + blocked labels]
🚨 Blockers Found:

Critical Issue:
- #52: Module Federation Singleton Violations
  Blocking: #60 (TypeScript Templates), #45 (BFF Layer)
  Open for: 5 days
  Assigned: @dev-team

Blocked Issues:
- #60: Waiting on #52 resolution
- #47: Waiting on design approval (no issue link)
```

### Velocity and Metrics

```
You: "What's our velocity?"

Agent: [Queries closed issues by date]
📈 Team Velocity (Last 4 Weeks):

Week of Nov 1: 6 issues closed
Week of Nov 8: 8 issues closed
Week of Nov 15: 7 issues closed
Week of Nov 22: 9 issues closed

Average: 7.5 issues/week
Trend: ↗️ Increasing

Current sprint (ends Dec 1):
- Planned: 12 issues
- Completed: 7 (58%)
- Pace: On track (need 5 more, 7 days left)
```

### Risk Assessment

```
You: "Any risks to the v2.0 release?"

Agent: [Queries milestone, priority, status]
⚠️ Risk Assessment: v2.0 Release

High Risk:
- 2 critical issues still open (25% of milestone)
- 1 issue stale for 2 weeks (#47)
- 3 high-priority features at 40% completion

Medium Risk:
- No assigned developer on 4 issues
- 2 features have merge conflicts

Low Risk:
- Tests passing on all open PRs
- No production incidents

Recommendation:
- Focus sprint on critical issues #52, #73
- Assign developers to unassigned work
- Consider scope cut: defer #47 to v2.1
```

---

## Label Management

### Standard Labels Applied by Agent

When agent drafts issue descriptions, it suggests labels:

```
📋 Suggested Labels:

Priority (pick one):
✅ priority-high (feature is blocking others)
  priority-medium
  priority-low

Type (pick one):
✅ type-feature (new capability)
  type-bug
  type-enhancement

Component (pick all that apply):
✅ component-bff (primary)
✅ component-deploy (Docker update needed)

Requirement (pick one):
✅ req-bff (links to docs/graphql-bff-requirements.md)
```

### Querying by Multiple Labels

```
You: "High priority BFF features not started"

Agent: [Complex query]
is:issue state:open
  label:priority-high
  label:component-bff
  label:type-feature
  -label:status-in-progress

Result: 2 issues match criteria
- #70: GraphQL Subscriptions
- #75: Schema Stitching
```

### Label Evolution

As project matures, you can add labels:

```yaml
# New labels added in GitHub:
priority-critical    # Red
type-security        # Orange
status-in-review     # Blue
```

Agent automatically discovers and uses them:

```
You: "Find security issues"

Agent: [Discovers new label]
Found label: type-security (added recently)

Security Issues:
- #80: JWT validation bypass (CRITICAL - 2 days old)
- #82: CORS misconfiguration (HIGH - 1 week old)
```

---

## Best Practices

### Do's

✅ **Query before creating** - Avoid duplicate issues  
✅ **Use specific labels** - Makes filtering easier  
✅ **Link requirements** - Maintain traceability  
✅ **Update promptly** - Keep issue status current  
✅ **Comment liberally** - Document decisions in issue  
✅ **Close when done** - Don't leave completed work open

### Don'ts

❌ **Don't maintain BACKLOG.md** - GitHub Issues is authoritative  
❌ **Don't skip templates** - Use `.github/ISSUE_TEMPLATE/`  
❌ **Don't forget labels** - They enable powerful queries  
❌ **Don't lose traceability** - Always reference REQ-XXX  
❌ **Don't create issues prematurely** - Wait until requirements are clear

---

## Troubleshooting

### Agent Not Finding Issues

**Problem:** Agent says "No issues found" but you know they exist.

**Solutions:**

- Check if labels are exact match (case-sensitive)
- Try broader query: "all open issues" first
- Verify repository name in query
- Check if issues are in different repo

### Too Many Results

**Problem:** Query returns 50+ issues, overwhelming.

**Solutions:**

- Add more label filters: `priority-high component-bff`
- Limit by time: "high priority issues updated this week"
- Focus on specific milestone: "v2.0 milestone issues"
- Ask agent to summarize: "Summarize top 5 by priority"

### Sync Out of Date

**Problem:** Requirements doc shows old issue status.

**Solutions:**

- Ask agent: "Query current status of issue #65"
- Agent fetches live data from GitHub
- Agent updates requirements doc with latest
- Always trust GitHub as source of truth

### Can't Create Issues via Agent

**Note:** This is by design. Agents query and draft, but don't create issues directly.

**Why:**

- User control over issue creation
- Allows review before submission
- Prevents accidental spam
- Ensures proper template usage

**Workflow:**

1. Agent drafts description
2. Agent suggests labels
3. User creates in GitHub UI
4. User provides issue number back
5. Agent updates requirements doc

---

## Examples from Real Sessions

### Example 1: Sprint Planning

```
You: "Help me plan the next sprint"

Agent: [Queries backlog]
📅 Sprint Planning Recommendations:

Current capacity: ~8 issues/week (based on velocity)

High Priority Candidates (5 issues):
1. #52: Module Federation Singleton Violations (2-3 days)
2. #70: GraphQL Subscriptions (3-4 days)
3. #38: Troubleshooting Documentation (1 day)
4. #75: Schema Stitching (2-3 days)
5. #45: BFF Layer Code Generation (4-5 days)

Total estimated: 12-16 days of work
Recommended: Take #52, #38, #70 (critical path)
Defer: #75, #45 (to next sprint)

Would you like me to create a milestone for "Sprint 6"?
(Note: I can draft, but you'll need to create it in GitHub)
```

### Example 2: Incident Response

```
You: "Production issue - BFF layer is timing out"

Agent: [Queries BFF issues]
🚨 BFF Component - Recent Activity:

Open Issues:
- #65: Redis Caching (CLOSED 2 days ago - recently merged!)
- #78: Connection Pool Exhaustion (OPEN - filed 1 hour ago)

Possible Culprit:
- PR #66 (Redis caching) merged yesterday
- #78 mentions timeout issues after deployment

Recommendation:
1. Check #78 for updates (active discussion)
2. Review PR #66 for connection pool settings
3. Consider hotfix or rollback

Related closed issues (potential regressions):
- #60: Response caching issues (closed 1 month ago)
```

### Example 3: Requirement Coverage Audit

```
You: "Verify all orchestration requirements have issues"

Agent: [Cross-references requirements doc with GitHub]
📋 Orchestration Requirements Coverage:

REQ-001 to REQ-010: ✅ Issue #15
REQ-011 to REQ-020: ✅ Issue #18
REQ-021 to REQ-030: ❌ No issue found!
REQ-031 to REQ-041: ✅ Issue #19, #20

⚠️ Gap Found: REQ-021 to REQ-030 not tracked

Requirements summary:
- REQ-021: Lightweight Registry (Metadata Only)
- REQ-025: Health Check Monitoring
- REQ-030: JWT-based Authorization

Recommendation: Create issue for requirements #21-30
Would you like me to draft the issue description?
```

---

## Migration from BACKLOG.md

If you have existing `docs/BACKLOG.md` entries not yet in GitHub Issues:

### Step 1: Audit

```
You: "Compare BACKLOG.md with GitHub Issues"

Agent: [Reads BACKLOG.md, queries GitHub]
📊 Migration Status:

From BACKLOG.md (50 entries):
- ✅ Migrated: 38 issues (in GitHub)
- ❌ Not migrated: 12 issues (missing)

Missing entries:
1. TypeScript Template Support
2. Integration Testing Framework
3. Kubernetes Helm Charts
... (9 more)
```

### Step 2: Create Missing Issues

```
You: "Create issues for the 12 missing entries"

Agent: "I'll draft descriptions for each. Here's the first:"

---
Title: TypeScript Template Support

## Requirements Reference
- REQ-SCAFFOLD-007: TypeScript project generation
...

(Agent drafts all 12, user creates in GitHub)
```

### Step 3: Archive BACKLOG.md

```
You: "Mark BACKLOG.md as deprecated"

Agent: [Updates file header]
# Product Backlog — seans-mfe-tool

> ⚠️ DEPRECATED (2025-11-28): See GitHub Issues
> All entries migrated to: https://github.com/.../issues

[Historical content preserved below]
```

---

## Related Documentation

- **Agent System Overview:** `.github/agents/README.md`
- **Requirements Elicitation Agent:** `.github/agents/requirements-elicitation-agent.md`
- **Issue Templates:** `.github/ISSUE_TEMPLATE/`
- **Requirements Traceability:** `docs/TRACEABILITY.md`
- **Live Backlog:** [GitHub Issues](https://github.com/falese/seans-mfe-tool/issues)
