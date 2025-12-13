# GitHub Issue Templates for Lifecycle Enhancements

This document provides **ready-to-use issue descriptions** for creating GitHub Issues. Use these templates with the `gh issue create` command.

---

## Issue #1: REQ-LIFECYCLE-002 - Timeout Protection

### Command

````bash
gh issue create \
  --title "REQ-LIFECYCLE-002: Timeout Protection for Handler Execution" \
  --label "priority-high,type-feature,component-runtime,req-lifecycle" \
  --milestone "Lifecycle Enhancements Phase 1" \
  --body-file <(cat <<'EOF'
## Requirement

Implement **REQ-LIFECYCLE-002** from [docs/requirements/lifecycle-enhancements.md](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-002)

## Description

Add timeout protection to prevent hung handler operations. Handlers can hang indefinitely due to network timeouts, infinite loops, or deadlocks, blocking MFE lifecycle execution.

## Business Value

- **Reliability**: Prevents hung operations from blocking system
- **User Experience**: Fast failure with meaningful error message
- **Resource Efficiency**: Frees resources from hung operations

## Implementation Approach

### 1. Create TimeoutError Class

**File**: `src/runtime/errors/TimeoutError.ts`

```typescript
export class TimeoutError extends Error {
  readonly type = 'timeout';
  readonly retryable = true;
  elapsed: number;
  timeout: number;
  handler: string;

  constructor(message: string, handler: string, timeout: number, elapsed: number) {
    super(message);
    this.name = 'TimeoutError';
    this.handler = handler;
    this.timeout = timeout;
    this.elapsed = elapsed;
  }
}
````

### 2. Implement Timeout Wrapper

**File**: `src/runtime/timeout-wrapper.ts`

- Use `Promise.race()` pattern
- Integrate AbortSignal for cancellation
- Support `onTimeout` behavior: "error" | "warn" | "skip"

### 3. Update BaseMFE.invokeHandler()

**File**: `src/runtime/base-mfe.ts`

- Add timeout parameter to `invokeHandler()`
- Call timeout wrapper with precedence: hook > handler > phase > global
- Handle `onTimeout` flag

### 4. Global Configuration Schema

**File**: `src/dsl/schema.ts`

```yaml
timeouts:
  phases:
    before: 5000
    main: 30000
    after: 10000
    error: 5000
  handlers:
    platform.auth: 3000
    queryEHR: 10000
```

### 5. Manifest Validation

- Validate `timeout` field (positive integer)
- Validate `onTimeout` enum

### 6. Telemetry Integration

Emit `lifecycle.timeout` event with: hook, handler, phase, timeout, elapsed, onTimeout

## Acceptance Criteria

See: [docs/acceptance-criteria/lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature) - "Feature 2: Timeout Protection"

- [ ] Handler-level `timeout` field enforces time limit
- [ ] `onTimeout: error` throws error and triggers error phase
- [ ] `onTimeout: warn` logs warning and continues
- [ ] `onTimeout: skip` silently continues
- [ ] Global timeout defaults configurable per phase
- [ ] Handler-specific defaults override phase defaults
- [ ] Hook-level timeout overrides all defaults
- [ ] `timeout: null` disables timeout
- [ ] Timeout respects `contained` flag
- [ ] Timeout integrates with retry logic (Phase 1)
- [ ] Telemetry tracks timeout events
- [ ] AbortSignal passed to handlers
- [ ] 100% test coverage

## Related Documentation

- **Requirement**: [REQ-LIFECYCLE-002](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-002)
- **ADR**: [ADR-064](https://github.com/falese/seans-mfe-tool/blob/develop/docs/architecture-decisions/ADR-064-timeout-protection.md)
- **Acceptance Criteria**: [lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature)
- **Implementation Plan**: [Phase 1](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements-implementation-plan.md#phase-1-foundation-weeks-1-2)

## Implementation Notes

- **Depends on**: None
- **Enables**: Timeout integration with retry logic (Issue #2)
- **Files to create**:
  - `src/runtime/errors/TimeoutError.ts`
  - `src/runtime/timeout-wrapper.ts`
  - `src/runtime/__tests__/timeout-wrapper.test.ts`
- **Files to modify**:
  - `src/runtime/base-mfe.ts` (update `invokeHandler()`)
  - `src/dsl/schema.ts` (add timeout config)

## Definition of Done

- [ ] Implementation complete per requirements
- [ ] Unit tests pass with 100% coverage
- [ ] Integration test: Timeout + Retry passing
- [ ] Telemetry events emitted correctly
- [ ] Example created: `examples/timeout-demo/`
- [ ] Documentation updated:
  - User guide: How to configure timeouts
  - API reference: TimeoutError, timeout config
- [ ] Code review approved
- [ ] Requirements doc status: ✅ Complete
- [ ] ADR updated with "Implementation Confirmed" section

EOF
)

````

---

## Issue #2: REQ-LIFECYCLE-005 - Error Classification & Smart Retry

### Command

```bash
gh issue create \
  --title "REQ-LIFECYCLE-005: Error Classification with Hybrid Detection & Smart Retry" \
  --label "priority-high,type-feature,component-runtime,req-lifecycle" \
  --milestone "Lifecycle Enhancements Phase 1" \
  --body-file <(cat <<'EOF'
## Requirement

Implement **REQ-LIFECYCLE-005** from [docs/requirements/lifecycle-enhancements.md](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-005)

## Description

Add error classification system to distinguish between error types (network, validation, business, security) and enable smart retry logic with exponential backoff.

## Business Value

- **Resilience**: Smart retry for transient failures (network errors)
- **User Experience**: User-friendly error messages (validation errors)
- **Security**: Sensitive errors logged, not exposed (security errors)
- **Cost**: Reduce unnecessary retries (90% reduction target)

## Implementation Approach

### 1. Create Typed Error Classes

**Files**: `src/runtime/errors/*.ts`

```typescript
// NetworkError.ts
export class NetworkError extends Error {
  readonly type = 'network';
  readonly retryable = true;
  statusCode: number;
}

// ValidationError.ts
export class ValidationError extends Error {
  readonly type = 'validation';
  readonly retryable = false;
  readonly userFacing = true;
  field: string;
  constraint: string;
}

// SecurityError.ts
export class SecurityError extends Error {
  readonly type = 'security';
  readonly retryable = false;
  readonly auditLog = true;
  readonly userMessage = 'Access denied';
}

// BusinessError.ts, SystemError.ts (similar)
````

### 2. Implement Error Classifier

**File**: `src/runtime/error-classifier.ts`

- Detect typed errors (check `type` property)
- Pattern matching fallback (regex on `error.message`)
- Return `ErrorClassification` object

### 3. Implement Retry Logic

**File**: `src/runtime/retry-wrapper.ts`

- Exponential backoff: `delay = baseDelay * 2^attempt`
- Linear backoff: `delay = baseDelay * attempt`
- Constant backoff: `delay = baseDelay`
- Jitter: ±20% random to prevent thundering herd
- Respect `maxRetries`

### 4. Implement onRetry Hook

- Modify context before each retry
- Track state: `context.retry = { attempt, isRetry, previousErrors }`

### 5. Implement Fallback Handler

- Mark context: `context.fallback = { active: true, reason, retriesExhausted }`
- Invoke fallback with modified context

### 6. User-Facing Error Formatting

**File**: `src/runtime/error-formatter.ts`

- Sanitize errors for user (no stack traces)
- Security errors: generic message "Access denied"
- Audit logging for security errors

### 7. Manifest Schema

**File**: `src/dsl/schema.ts`

```yaml
errorHandling:
  types:
    - type: network
      retryable: true
      maxRetries: 3
      backoff: exponential
      baseDelay: 1000
      maxDelay: 10000
      jitter: true
      onRetry: adjustContext
      fallbackHandler: useCachedData
```

### 8. Telemetry Integration

- `lifecycle.error.classified`
- `lifecycle.error.retry`
- `lifecycle.error.fallback`

## Acceptance Criteria

See: [docs/acceptance-criteria/lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature) - "Feature 5: Error Classification & Handling"

- [ ] Handlers throw typed errors
- [ ] Pattern matching works for third-party handlers
- [ ] Retry strategy respects error type
- [ ] Exponential backoff implemented correctly
- [ ] Context tracks retry state
- [ ] onRetry hook called before each retry
- [ ] Fallback handler receives modified context
- [ ] User-facing errors sanitized
- [ ] Security errors logged to audit trail
- [ ] Telemetry tracks error classification
- [ ] 100% test coverage

## Related Documentation

- **Requirement**: [REQ-LIFECYCLE-005](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-005)
- **ADR**: [ADR-065](https://github.com/falese/seans-mfe-tool/blob/develop/docs/architecture-decisions/ADR-065-error-classification.md)
- **Acceptance Criteria**: [lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature)
- **Implementation Plan**: [Phase 1](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements-implementation-plan.md#phase-1-foundation-weeks-1-2)

## Implementation Notes

- **Depends on**: Issue #1 (TimeoutError integration)
- **Enables**: Retry + Timeout integration
- **Files to create**:
  - `src/runtime/errors/NetworkError.ts`
  - `src/runtime/errors/ValidationError.ts`
  - `src/runtime/errors/SecurityError.ts`
  - `src/runtime/errors/BusinessError.ts`
  - `src/runtime/errors/SystemError.ts`
  - `src/runtime/error-classifier.ts`
  - `src/runtime/retry-wrapper.ts`
  - `src/runtime/error-formatter.ts`
  - `src/runtime/__tests__/error-classifier.test.ts`
  - `src/runtime/__tests__/retry-wrapper.test.ts`
- **Files to modify**:
  - `src/runtime/base-mfe.ts` (integrate error classification)
  - `src/dsl/schema.ts` (add errorHandling config)

## Definition of Done

- [ ] Implementation complete per requirements
- [ ] Unit tests pass with 100% coverage
- [ ] Integration test: Retry + Timeout passing
- [ ] Telemetry events emitted correctly
- [ ] Example created: `examples/error-classification-demo/`
- [ ] Documentation updated:
  - User guide: Error handling strategies
  - API reference: Error classes, retry config
- [ ] Security team review approved (error sanitization)
- [ ] Code review approved
- [ ] Requirements doc status: ✅ Complete
- [ ] ADR updated with "Implementation Confirmed" section

EOF
)

````

---

## Issue #3: REQ-LIFECYCLE-003 - Conditional Execution

### Command

```bash
gh issue create \
  --title "REQ-LIFECYCLE-003: Conditional Handler Execution with Jexl" \
  --label "priority-high,type-feature,component-runtime,req-lifecycle" \
  --milestone "Lifecycle Enhancements Phase 2" \
  --body-file <(cat <<'EOF'
## Requirement

Implement **REQ-LIFECYCLE-003** from [docs/requirements/lifecycle-enhancements.md](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-003)

## Description

Add conditional execution capability to skip handlers based on runtime state. Uses Jexl (JavaScript Expression Language) for safe, sandboxed expression evaluation.

## Business Value

- **Performance**: Skip unnecessary operations (30% reduction target)
- **Clarity**: Business rules visible in manifest
- **Flexibility**: Dynamic behavior without code changes

## Implementation Approach

### 1. Install Jexl Library

```bash
npm install jexl
````

### 2. Create ConditionEvaluator

**File**: `src/runtime/condition-evaluator.ts`

```typescript
import jexl from 'jexl';

export class ConditionEvaluator {
  private jexl: Jexl;
  private compiledCache: Map<string, CompiledExpression>;

  constructor() {
    this.jexl = new Jexl();
    this.compiledCache = new Map();

    // Add custom transforms
    this.jexl.addTransform('includes', (arr, val) => arr?.includes(val));
    this.jexl.addTransform('matches', (str, pattern) => new RegExp(pattern).test(str));
    this.jexl.addTransform('startsWith', (str, prefix) => str?.startsWith(prefix));
    this.jexl.addTransform('endsWith', (str, suffix) => str?.endsWith(suffix));
  }

  async evaluateCondition(condition, evaluationContext): Promise<boolean> {
    // Compile and evaluate expression
    // Handle complex boolean logic (and/or/not)
  }

  validateExpression(expression: string): { valid: boolean; error?: string } {
    // Compile to validate syntax
  }
}
```

### 3. Integrate with Lifecycle Engine

**File**: `src/runtime/base-mfe.ts`

- Check `when` field before handler invocation
- Evaluate expression with context: `{ context, env, manifest }`
- Skip handler if condition false
- Optional: Log skip if `debugCondition: true`

### 4. Manifest Schema

```yaml
lifecycle:
  before:
    - checkAuth:
        handler: platform.auth
        when: 'context.jwt != null'
        debugCondition: false # Optional verbose logging
```

### 5. Manifest Validation

**File**: `src/dsl/validator.ts`

- Compile all `when` expressions at parse time
- Fail fast on syntax errors

### 6. Telemetry Integration

Emit `lifecycle.condition.skipped` event with: hook, condition, result

## Acceptance Criteria

See: [docs/acceptance-criteria/lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature) - "Feature 3: Conditional Execution"

- [ ] `when` field accepts string expression
- [ ] `when` field accepts complex object (and/or/not)
- [ ] Expression evaluated before handler invocation
- [ ] False condition skips handler silently
- [ ] Invalid expressions caught at manifest validation
- [ ] Expression evaluation errors skip handler (treat as false)
- [ ] `when: null` or absent = always execute (default)
- [ ] Expressions access context, env, manifest
- [ ] Telemetry tracks skipped handlers
- [ ] `debugCondition: true` logs evaluation details
- [ ] Performance: Expression evaluation < 1ms
- [ ] 100% test coverage

## Related Documentation

- **Requirement**: [REQ-LIFECYCLE-003](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-003)
- **ADR**: [ADR-066](https://github.com/falese/seans-mfe-tool/blob/develop/docs/architecture-decisions/ADR-066-conditional-execution.md)
- **Acceptance Criteria**: [lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature)
- **Implementation Plan**: [Phase 2](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements-implementation-plan.md#phase-2-optimization-weeks-3-4)
- **Jexl Documentation**: https://github.com/TomFrost/Jexl

## Implementation Notes

- **Depends on**: None (independent feature)
- **Enables**: Conditional + Timeout integration, Conditional + Parallel integration
- **Files to create**:
  - `src/runtime/condition-evaluator.ts`
  - `src/runtime/__tests__/condition-evaluator.test.ts`
- **Files to modify**:
  - `src/runtime/base-mfe.ts` (check `when` before invoking handler)
  - `src/dsl/schema.ts` (add `when` field)
  - `src/dsl/validator.ts` (validate expressions)

## Definition of Done

- [ ] Implementation complete per requirements
- [ ] Unit tests pass with 100% coverage
- [ ] Performance test: Expression evaluation < 1ms
- [ ] Telemetry events emitted correctly
- [ ] Example created: `examples/conditional-demo/`
- [ ] Documentation updated:
  - User guide: Conditional execution patterns
  - API reference: Expression syntax, custom transforms
- [ ] Code review approved
- [ ] Requirements doc status: ✅ Complete
- [ ] ADR updated with "Implementation Confirmed" section

EOF
)

````

---

## Issue #4: REQ-LIFECYCLE-001 - Parallel Handler Execution

### Command

```bash
gh issue create \
  --title "REQ-LIFECYCLE-001: Parallel Handler Execution with Context Isolation" \
  --label "priority-medium,type-feature,component-runtime,req-lifecycle" \
  --milestone "Lifecycle Enhancements Phase 2" \
  --body-file <(cat <<'EOF'
## Requirement

Implement **REQ-LIFECYCLE-001** from [docs/requirements/lifecycle-enhancements.md](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-001)

## Description

Enable concurrent execution of independent handlers to reduce latency. Implements context isolation to prevent race conditions and supports multiple failure strategies.

## Business Value

- **Performance**: 3x faster execution for independent operations (target)
- **User Experience**: Reduced page load time for MFE initialization
- **Cost Optimization**: Fewer idle CPU cycles waiting on I/O

## Implementation Approach

### 1. Implement Context Isolation

**File**: `src/runtime/context-isolator.ts`

- Create read-only context copies for each parallel handler
- Namespace outputs: `context.parallelOutputs[handlerName]`

### 2. Implement Parallel Executor

**File**: `src/runtime/parallel-executor.ts`

```typescript
async executeParallelHandlers(
  handlers: string[],
  config: ParallelConfig,
  context: Context
): Promise<void> {
  const strategy = config.failureStrategy || 'fail-fast';

  if (strategy === 'fail-fast') {
    // Use Promise.race wrapper with cancellation
  } else if (strategy === 'complete-all') {
    // Use Promise.allSettled
  } else if (strategy === 'partial-success') {
    // Custom logic: continue if ≥1 succeeds
  }

  // Merge outputs to main context
  this.mergeParallelOutputs(context, results);
}
````

### 3. Implement Output Merger

**File**: `src/runtime/output-merger.ts`

- Deep merge objects (use `lodash.merge`)
- Concatenate arrays
- Warn on conflicts (two handlers write same field)

### 4. Integrate with Lifecycle Engine

**File**: `src/runtime/base-mfe.ts`

- Detect `parallel: true` flag in hook config
- Invoke parallel executor
- Merge outputs to main context

### 5. Manifest Schema

```yaml
lifecycle:
  before:
    - securityChecks:
        handler: [platform.auth, validatePCI, checkFraudRisk]
        parallel: true
        maxConcurrency: 3 # Optional limit
        failureStrategy: 'fail-fast' # or "complete-all" or "partial-success"
```

### 6. Telemetry Integration

Emit `lifecycle.parallel.complete` event with: handlers, durations, failures, strategy

## Acceptance Criteria

See: [docs/acceptance-criteria/lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature) - "Feature 1: Parallel Execution"

- [ ] `parallel: true` executes handlers concurrently
- [ ] `failureStrategy: fail-fast` cancels on first error
- [ ] `failureStrategy: complete-all` waits for all handlers
- [ ] `failureStrategy: partial-success` succeeds if ≥1 handler succeeds
- [ ] Context mutations isolated during execution
- [ ] Outputs merged to main context after completion
- [ ] Telemetry tracks parallel execution metrics
- [ ] Context conflicts logged as warnings
- [ ] Performance: 3x speedup for 3 independent handlers
- [ ] Parallel execution overhead < 10ms
- [ ] 100% test coverage

## Related Documentation

- **Requirement**: [REQ-LIFECYCLE-001](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-001)
- **ADR**: [ADR-063](https://github.com/falese/seans-mfe-tool/blob/develop/docs/architecture-decisions/ADR-063-parallel-execution.md)
- **Acceptance Criteria**: [lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature)
- **Implementation Plan**: [Phase 2](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements-implementation-plan.md#phase-2-optimization-weeks-3-4)

## Implementation Notes

- **Depends on**: Issue #2 (Error Classification for failure strategies)
- **Enables**: Parallel + Timeout integration, Parallel + Conditional integration
- **Files to create**:
  - `src/runtime/context-isolator.ts`
  - `src/runtime/parallel-executor.ts`
  - `src/runtime/output-merger.ts`
  - `src/runtime/__tests__/parallel-executor.test.ts`
  - `src/runtime/__tests__/output-merger.test.ts`
- **Files to modify**:
  - `src/runtime/base-mfe.ts` (detect `parallel` flag, invoke executor)
  - `src/dsl/schema.ts` (add parallel config)

## Definition of Done

- [ ] Implementation complete per requirements
- [ ] Unit tests pass with 100% coverage
- [ ] Performance test: 3x speedup vs sequential
- [ ] Parallel execution overhead < 10ms
- [ ] Integration test: Parallel + Error Classification passing
- [ ] Telemetry events emitted correctly
- [ ] Example created: `examples/parallel-demo/`
- [ ] Documentation updated:
  - User guide: When to use parallel execution
  - API reference: Parallel config, failure strategies
- [ ] Code review approved
- [ ] Requirements doc status: ✅ Complete
- [ ] ADR updated with "Implementation Confirmed" section

EOF
)

````

---

## Issue #5: REQ-LIFECYCLE-004 - Inter-Hook Communication

### Command

```bash
gh issue create \
  --title "REQ-LIFECYCLE-004: Inter-Hook Communication with TypeScript Code Generation" \
  --label "priority-medium,type-feature,component-runtime,component-codegen,req-lifecycle" \
  --milestone "Lifecycle Enhancements Phase 3" \
  --body-file <(cat <<'EOF'
## Requirement

Implement **REQ-LIFECYCLE-004** from [docs/requirements/lifecycle-enhancements.md](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-004)

## Description

Add typed inputs/outputs for hooks to enable compile-time type safety and explicit data flow. Includes TypeScript code generation from DSL manifest.

## Business Value

- **Type Safety**: Compile-time checks for data flow (50% reduction in runtime type errors)
- **Clarity**: Explicit dependencies visible in manifest
- **Maintainability**: Refactoring detects broken contracts
- **Documentation**: Auto-generated interfaces serve as API docs

## Implementation Approach

### 1. Extend Manifest Schema

**File**: `src/dsl/schema.ts`

```yaml
lifecycle:
  before:
    - validateInput:
        handler: checkSchema
        outputs:
          - name: validationResult
            type: boolean
            required: true
          - name: errors
            type: array<string>
            required: false
    - logValidation:
        handler: logResult
        inputs:
          - name: result
            from: validationResult
            required: true
````

### 2. Create TypeGenerator

**File**: `src/codegen/type-generator.ts`

- Generate output interfaces
- Generate input interfaces
- Generate handler type signatures
- Use `ts-morph` for AST manipulation

### 3. Implement Input Resolver

**File**: `src/runtime/input-resolver.ts`

- Parse `from` references (hookName.outputName)
- Resolve from `context.hookOutputs`
- Validate required inputs present

### 4. Implement Output Validator

**File**: `src/runtime/output-validator.ts`

- Validate output types match schema
- Check required outputs present

### 5. Implement Dependency Graph Validator

**File**: `src/dsl/dependency-validator.ts`

- Build dependency graph from inputs/outputs
- Detect circular dependencies (DFS algorithm)
- Visualize cycles in error message

### 6. Integrate with Lifecycle Engine

**File**: `src/runtime/base-mfe.ts`

- Resolve inputs before handler invocation
- Pass inputs as second parameter
- Validate outputs after handler execution
- Store outputs in `context.hookOutputs[hookName]`

### 7. CLI Integration

**New command**: `mfe generate-types <manifest>`

- Generate TypeScript interfaces
- Store in `src/generated/interfaces.ts`
- Auto-run during `mfe remote <name>`

## Acceptance Criteria

See: [docs/acceptance-criteria/lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature) - "Feature 4: Inter-Hook Communication"

- [ ] Hooks declare typed outputs
- [ ] Hooks declare typed inputs with `from` references
- [ ] Runtime validates output types
- [ ] Missing required output throws error
- [ ] Missing required input throws error
- [ ] Outputs namespaced by hook name
- [ ] Explicit namespace syntax (`hookName.outputName`)
- [ ] Code generation creates TypeScript interfaces
- [ ] Circular dependencies detected at validation
- [ ] Telemetry tracks output schemas
- [ ] Generated TypeScript code compiles successfully
- [ ] 100% test coverage

## Related Documentation

- **Requirement**: [REQ-LIFECYCLE-004](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements.md#req-lifecycle-004)
- **ADR**: [ADR-067](https://github.com/falese/seans-mfe-tool/blob/develop/docs/architecture-decisions/ADR-067-inter-hook-communication.md)
- **Acceptance Criteria**: [lifecycle-enhancements.feature](https://github.com/falese/seans-mfe-tool/blob/develop/docs/acceptance-criteria/lifecycle-enhancements.feature)
- **Implementation Plan**: [Phase 3](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements-implementation-plan.md#phase-3-advanced-weeks-5-6)

## Implementation Notes

- **Depends on**: None (but leverages all previous features)
- **Enables**: Type-safe hook communication, compile-time validation
- **External Libraries**: `npm install ts-morph`
- **Files to create**:
  - `src/codegen/type-generator.ts`
  - `src/runtime/input-resolver.ts`
  - `src/runtime/output-validator.ts`
  - `src/dsl/dependency-validator.ts`
  - `src/commands/generate-types.js`
  - `src/codegen/__tests__/type-generator.test.ts`
  - `src/runtime/__tests__/input-resolver.test.ts`
  - `src/dsl/__tests__/dependency-validator.test.ts`
- **Files to modify**:
  - `src/runtime/base-mfe.ts` (resolve inputs, validate outputs)
  - `src/dsl/schema.ts` (add inputs/outputs fields)
  - `bin/seans-mfe-tool.js` (add `generate-types` command)

## Definition of Done

- [ ] Implementation complete per requirements
- [ ] Unit tests pass with 100% coverage
- [ ] Generated TypeScript code compiles
- [ ] CLI command works end-to-end
- [ ] Circular dependency detection works
- [ ] Integration test: Inter-hook + Timeout passing
- [ ] Telemetry events emitted correctly
- [ ] Example created: `examples/typed-communication-demo/`
- [ ] Documentation updated:
  - User guide: Typed inter-hook communication
  - API reference: Type system, generated interfaces
- [ ] Code review approved
- [ ] Requirements doc status: ✅ Complete
- [ ] ADR updated with "Implementation Confirmed" section

EOF
)

````

---

## Issue #6: CLI Validation Command

### Command

```bash
gh issue create \
  --title "CLI: Manifest Validation Command (mfe validate-manifest)" \
  --label "priority-medium,type-feature,component-cli,req-lifecycle" \
  --milestone "Lifecycle Enhancements Phase 4" \
  --body-file <(cat <<'EOF'
## Description

Create `mfe validate-manifest` CLI command to statically validate manifests and suggest optimizations. Integrates with pre-build scripts for CI/CD pipelines.

## Business Value

- **Developer Experience**: Catch errors before runtime
- **Optimization**: Surface missed optimization opportunities
- **CI/CD Integration**: Pre-build validation prevents broken deployments

## Implementation Approach

### 1. Create Validator Command

**File**: `src/commands/validate-manifest.js`

```javascript
async function validateManifest(manifestPath, options) {
  // Load and parse manifest
  const manifest = await loadManifest(manifestPath);

  // Run all validation rules
  const results = {
    errors: [],
    warnings: [],
    suggestions: []
  };

  // Check expression syntax (conditional execution)
  results.errors.push(...validateExpressions(manifest));

  // Check type definitions (inter-hook communication)
  results.errors.push(...validateTypes(manifest));

  // Check circular dependencies
  results.errors.push(...detectCircularDependencies(manifest));

  // Suggest optimizations
  results.suggestions.push(...suggestTimeouts(manifest));
  results.suggestions.push(...suggestParallel(manifest));

  // Output results
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printResults(results);
  }

  // Exit codes
  if (results.errors.length > 0) process.exit(1);
  if (results.warnings.length > 0) process.exit(2);
  process.exit(0);
}
````

### 2. Validation Rules

- **Expression Syntax**: Validate `when` expressions compile
- **Type Definitions**: Validate `inputs`/`outputs` types
- **Circular Dependencies**: Detect cycles in dependency graph
- **Timeout Recommendations**: Warn if handler > 10s without timeout
- **Parallel Opportunities**: Suggest `parallel: true` for independent handlers

### 3. CLI Integration

**File**: `bin/seans-mfe-tool.js`

```javascript
program
  .command('validate-manifest')
  .argument('[path]', 'Path to manifest file', './.well-known/mfe-manifest.yaml')
  .option('--json', 'Output JSON format')
  .description('Validate manifest and suggest optimizations')
  .action(validateManifest);
```

### 4. Pre-Build Integration

Add to generated `package.json`:

```json
{
  "scripts": {
    "prebuild": "mfe validate-manifest",
    "build": "rspack build"
  }
}
```

## Acceptance Criteria

- [ ] CLI command `mfe validate-manifest [path]` works
- [ ] Valid manifest passes with exit code 0
- [ ] Invalid expression caught with error
- [ ] Circular dependency caught with error
- [ ] Timeout recommendation generated
- [ ] Parallel opportunity suggested
- [ ] JSON output format works (`--json`)
- [ ] Pre-build integration tested
- [ ] 100% test coverage

## Related Documentation

- **Implementation Plan**: [Phase 4](https://github.com/falese/seans-mfe-tool/blob/develop/docs/requirements/lifecycle-enhancements-implementation-plan.md#phase-4-developer-experience-week-7)

## Implementation Notes

- **Depends on**: All previous phases (validates all features)
- **Files to create**:
  - `src/commands/validate-manifest.js`
  - `src/commands/__tests__/validate-manifest.test.js`
- **Files to modify**:
  - `bin/seans-mfe-tool.js` (add command)
  - `src/templates/react/remote/package.json.ejs` (add prebuild script)

## Definition of Done

- [ ] Implementation complete
- [ ] Unit tests pass with 100% coverage
- [ ] CLI command works end-to-end
- [ ] Pre-build integration tested
- [ ] Example created: `examples/validation-demo/`
- [ ] Documentation updated:
  - User guide: How to use validation
  - Rule reference: What each rule checks
- [ ] Code review approved

EOF
)

```

---

## Usage Instructions

1. **Create issues** using the commands above (adjust labels/milestones as needed)
2. **Track in GitHub**: Use project boards, milestones for progress tracking
3. **Update requirements docs**: Add issue numbers after creation
4. **Link in PRs**: Reference issues in commits and PRs

## Label System

Used in all issues above:

- `priority-high` / `priority-medium`: Priority level
- `type-feature`: Feature enhancement
- `component-runtime`: Runtime platform code
- `component-codegen`: Code generation utilities
- `component-cli`: CLI commands
- `req-lifecycle`: Links to lifecycle enhancement requirements

## Milestone Structure

- **Lifecycle Enhancements Phase 1**: Issues #1-#2 (Weeks 1-2)
- **Lifecycle Enhancements Phase 2**: Issues #3-#4 (Weeks 3-4)
- **Lifecycle Enhancements Phase 3**: Issue #5 (Weeks 5-6)
- **Lifecycle Enhancements Phase 4**: Issue #6 (Week 7)

---

**Total Issues**: 6
**Estimated Timeline**: 7 weeks
**Status**: ✅ Ready to create in GitHub
```
