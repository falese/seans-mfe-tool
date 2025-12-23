# @seans-mfe-tool/control - Orchestration Control Plane Implementation Plan

## Overview

The `@seans-mfe-tool/control` package is a **hybrid package** that serves as the orchestration control plane for the MFE ecosystem. It combines:
- **Library Exports**: Orchestration runtime, telemetry, validators (programmatic API)
- **Remote MFE**: Visual orchestration dashboard with developer tools
- **Daemon Bridge**: WebSocket client for Rust daemon integration

## User Requirements

- **Package Type**: Hybrid (both library and standalone MFE)
- **Daemon Integration**: Separate registry service (daemon provides discovery/metadata, browser loads MFEs)
- **Core Capabilities**: Visual dashboard, runtime library, daemon client/bridge, developer tools

---

## Implementation Status

### ✅ Completed Phases

**Phase 1: Package Structure & Setup**
- ✅ Package.json created with hybrid configuration
- ✅ TypeScript configuration with React JSX support
- ✅ Module Federation rspack.config.js (not yet tested)
- ✅ Build scripts integrated into root workspace

**Phase 2: Orchestration Runtime (Moved to Control)**
- ✅ OrchestrationContext - Extended context for multi-MFE state
- ✅ OrchestrationRuntime - Multi-MFE coordinator
- ✅ OrchestrationTelemetry - Workflow-level telemetry
- ✅ OrchestrationValidator - Multi-MFE validation utilities
- ✅ All exports properly configured in control package index

**Phase 3: Daemon Client/Bridge**
- ✅ DaemonClient - WebSocket client with reconnection logic
- ✅ RegistryClient - HTTP REST API client
- ✅ Protocol types aligned with daemon (types.ts)
- ✅ All daemon exports configured in control package index

**Phase 4: E2E Testing**
- ✅ OrchestrationHarness E2E tests (14/14 passing)
- ✅ Full test coverage for multi-MFE orchestration patterns
- ✅ Validation of parallel loading, partial failures, dependencies

**Phase 5: Workspace Integration**
- ✅ Root build scripts updated
- ✅ Root tsconfig references added
- ✅ Control package builds successfully

### 🚧 Pending Phases

**Phase 6: OrchestrationRuntime.createMFEInstance Implementation**
- ⚠️ Currently has placeholder implementation
- Needs: DSL manifest parsing + RemoteMFE instantiation
- **See daemon-integration-plan.md for full implementation**

**Phase 7: UI Components** (Not Started)
- ⬜ React hooks (useOrchestration, useDaemon, useTelemetry)
- ⬜ Dashboard components (OrchestrationDashboard, MFERegistryTable, HealthMonitor)
- ⬜ Telemetry viewer (TelemetryViewer, WorkflowTracer, EventTimeline)
- ⬜ Dependency graph visualizer (DependencyGraph, CapabilityMatrix)
- ⬜ Developer tools (PerformanceProfiler, OrchestrationPlayground, DebugConsole)

**Phase 8: Module Federation Build** (Not Tested)
- ⬜ Test rspack.config.js Module Federation setup
- ⬜ Verify remote entry generation
- ⬜ Test component exposure
- ⬜ Validate singleton shared dependencies

---

## Alpha Orchestration System - Validation

### Implementation Status: ✅ COMPLETE

All 5 phases of the Alpha Orchestration System have been implemented and tested:
- ✅ Phase 1: OrchestrationContext
- ✅ Phase 2: OrchestrationRuntime
- ✅ Phase 3: OrchestrationTelemetry
- ✅ Phase 4: OrchestrationHarness E2E Tests (14/14 passing)
- ✅ Phase 5: OrchestrationValidator

### Quick Validation

Run these commands to verify the orchestration system:

```bash
# 1. Navigate to mfe1 example
cd /Users/sean/Documents/Development/seans-mfe-tool/examples/mfe1

# 2. Run orchestration tests only
npm run test:e2e -- orchestration-harness.e2e.test.ts

# 3. Run all E2E tests (single + multi MFE)
npm run test:e2e
```

**Expected Results:**
- ✅ All 14 orchestration tests pass
- ✅ Tests cover: parallel loading, partial failures, dependencies, health monitoring, telemetry

---

## Next Steps

### Immediate Priority: Daemon Integration

**The control package is ready for daemon integration.**

See [daemon-integration-plan.md](./daemon-integration-plan.md) for:
- Rust daemon refactor plan (Component → MFE model)
- TypeScript integration updates (createMFEInstance implementation)
- WebSocket protocol alignment
- Health check scheduler design
- End-to-end integration testing

### Future Work: UI Components

Once daemon integration is complete, implement React UI components:

1. **useOrchestration Hook** - Initialize OrchestrationRuntime with daemon connection
2. **OrchestrationDashboard** - Visual registry viewer with health monitoring
3. **TelemetryViewer** - Real-time workflow and event tracking
4. **DependencyGraph** - Visual MFE dependency visualization
5. **DevTools** - Performance profiler and orchestration playground

---

## Key Architectural Decisions

1. **Hybrid Package**: Both library (for programmatic use) AND remote MFE (for visual UI)
2. **Daemon Separation**: Rust daemon provides registry/discovery, browser does actual loading
3. **Backward Compatibility**: Runtime package re-exports types from control (maintained)
4. **Component Exposure**: Module Federation exposes both runtime APIs and UI components
5. **Singleton Services**: DaemonClient and RegistryClient as injectable dependencies
6. **React Hooks**: Clean API for MFE consumers via hooks

---

## Files Overview

### Core Implementation Files (✅ Complete)

**Runtime:**
- [packages/control/src/runtime/OrchestrationRuntime.ts](packages/control/src/runtime/OrchestrationRuntime.ts) - Multi-MFE coordinator
- [packages/control/src/runtime/OrchestrationContext.ts](packages/control/src/runtime/OrchestrationContext.ts) - Extended context
- [packages/control/src/runtime/OrchestrationTelemetry.ts](packages/control/src/runtime/OrchestrationTelemetry.ts) - Workflow telemetry
- [packages/control/src/runtime/OrchestrationValidator.ts](packages/control/src/runtime/OrchestrationValidator.ts) - Multi-MFE validation

**Daemon Bridge:**
- [packages/control/src/daemon/DaemonClient.ts](packages/control/src/daemon/DaemonClient.ts) - WebSocket client
- [packages/control/src/daemon/RegistryClient.ts](packages/control/src/daemon/RegistryClient.ts) - HTTP REST client
- [packages/control/src/daemon/types.ts](packages/control/src/daemon/types.ts) - Protocol types
- [packages/control/src/daemon/index.ts](packages/control/src/daemon/index.ts) - Daemon exports

**Package Configuration:**
- [packages/control/package.json](packages/control/package.json) - Hybrid package config
- [packages/control/tsconfig.json](packages/control/tsconfig.json) - TypeScript config
- [packages/control/rspack.config.js](packages/control/rspack.config.js) - Module Federation config (untested)
- [packages/control/src/index.ts](packages/control/src/index.ts) - Main exports

### UI Component Files (⬜ Not Started)

**Hooks:**
- packages/control/src/hooks/useOrchestration.ts
- packages/control/src/hooks/useDaemon.ts
- packages/control/src/hooks/useTelemetry.ts

**Dashboard:**
- packages/control/src/features/Dashboard/OrchestrationDashboard.tsx
- packages/control/src/features/Dashboard/MFERegistryTable.tsx
- packages/control/src/features/Dashboard/HealthMonitor.tsx

**Telemetry:**
- packages/control/src/features/Telemetry/TelemetryViewer.tsx
- packages/control/src/features/Telemetry/WorkflowTracer.tsx
- packages/control/src/features/Telemetry/EventTimeline.tsx

**Dependencies:**
- packages/control/src/features/Dependencies/DependencyGraph.tsx
- packages/control/src/features/Dependencies/CapabilityMatrix.tsx

**DevTools:**
- packages/control/src/features/DevTools/PerformanceProfiler.tsx
- packages/control/src/features/DevTools/OrchestrationPlayground.tsx
- packages/control/src/features/DevTools/DebugConsole.tsx

---

## Testing Status

### ✅ E2E Tests (14/14 passing)

Location: [examples/mfe1/src/__tests__/e2e/orchestration-harness.e2e.test.ts](examples/mfe1/src/__tests__/e2e/orchestration-harness.e2e.test.ts)

**Test Coverage:**
- ✅ Parallel MFE loading (3 MFEs simultaneously)
- ✅ Partial failure handling (some MFEs succeed, others fail)
- ✅ Complete failure handling (all MFEs fail)
- ✅ Capability aggregation across multiple MFEs
- ✅ Dependency validation (required capabilities/MFEs)
- ✅ Health status monitoring
- ✅ Performance metrics (slowest MFE, critical path)
- ✅ Orchestration validation
- ✅ Workflow-level telemetry tracking

---

## Summary

The **@seans-mfe-tool/control** package provides the orchestration control plane for the MFE ecosystem. The core orchestration runtime is complete and tested. The daemon integration layer (DaemonClient, RegistryClient) is implemented and ready to connect to the Rust daemon once it's refactored.

**Next milestone:** Complete daemon refactor (see daemon-integration-plan.md) to enable end-to-end MFE orchestration with registry discovery, health monitoring, and real-time updates.
