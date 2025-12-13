# Lifecycle Engine Enhancements - Acceptance Criteria

**Feature**: Lifecycle Engine Enhancements  
**Related Documents**:
- [Requirements](../requirements/lifecycle-enhancements.md)
- [Lifecycle Engine Analysis](../lifecycle-engine-analysis.md)
- ADR-063 through ADR-067

---

## Feature 1: Parallel Handler Execution

### Scenario: Execute independent handlers concurrently
```gherkin
Given a manifest with parallel handlers:
  """yaml
  lifecycle:
    before:
      - securityChecks:
          handler: [platform.auth, validatePCI, checkFraudRisk]
          parallel: true
  """
When the lifecycle executes the before phase
Then all 3 handlers execute concurrently
And the total duration equals the longest handler duration
And context outputs are merged correctly
```

### Scenario: Fail-fast strategy cancels on first error
```gherkin
Given a manifest with fail-fast parallel handlers:
  """yaml
  lifecycle:
    before:
      - validations:
          handler: [checkA, checkB, checkC]
          parallel: true
          failureStrategy: "fail-fast"
  """
And checkB throws an error after 100ms
When the lifecycle executes
Then checkB error is thrown immediately
And checkA and checkC are cancelled
And execution does not complete
```

### Scenario: Complete-all strategy collects all errors
```gherkin
Given a manifest with complete-all parallel handlers:
  """yaml
  lifecycle:
    before:
      - validations:
          handler: [checkA, checkB, checkC]
          parallel: true
          failureStrategy: "complete-all"
  """
And checkB throws error "ValidationError: Invalid B"
And checkC throws error "ValidationError: Invalid C"
When the lifecycle executes
Then all 3 handlers complete execution
And checkA succeeds
And aggregated error contains both "Invalid B" and "Invalid C"
And execution continues (if contained: true)
```

### Scenario: Partial-success strategy succeeds if one handler succeeds
```gherkin
Given a manifest with partial-success parallel handlers:
  """yaml
  lifecycle:
    before:
      - dataFetch:
          handler: [primaryAPI, secondaryAPI, cacheAPI]
          parallel: true
          failureStrategy: "partial-success"
  """
And primaryAPI throws NetworkError
And cacheAPI succeeds with data
When the lifecycle executes
Then cacheAPI data is used
And execution continues successfully
And telemetry tracks primaryAPI failure
```

### Scenario: Context isolation prevents race conditions
```gherkin
Given a manifest with parallel handlers that write to context:
  """yaml
  lifecycle:
    before:
      - handlers:
          handler: [handlerA, handlerB, handlerC]
          parallel: true
  """
And handlerA sets context.result = "A"
And handlerB sets context.result = "B"
And handlerC sets context.user = { id: 123 }
When the lifecycle executes
Then outputs are namespaced:
  """
  context.parallelOutputs = {
    handlerA: { result: "A" },
    handlerB: { result: "B" },
    handlerC: { user: { id: 123 } }
  }
  """
And a warning is logged for context.result conflict
And context.user is merged without conflict
```

---

## Feature 2: Timeout Protection

### Scenario: Handler times out and throws error
```gherkin
Given a manifest with timeout configuration:
  """yaml
  lifecycle:
    before:
      - fetchData:
          handler: slowQuery
          timeout: 2000
          onTimeout: "error"
  """
And slowQuery takes 3000ms to complete
When the lifecycle executes
Then slowQuery is cancelled after 2000ms
And TimeoutError is thrown
And error phase is triggered
And telemetry event "lifecycle.timeout" is emitted
```

### Scenario: Handler times out and logs warning
```gherkin
Given a manifest with timeout warning:
  """yaml
  lifecycle:
    before:
      - optional:
          handler: slowOperation
          timeout: 1000
          onTimeout: "warn"
          contained: true
  """
And slowOperation takes 2000ms to complete
When the lifecycle executes
Then slowOperation is cancelled after 1000ms
And warning is logged: "Handler 'slowOperation' timed out (continued)"
And execution continues to next handler
And context.timeouts.slowOperation = { occurred: true, elapsed: 1000 }
```

### Scenario: Handler times out and skips silently
```gherkin
Given a manifest with timeout skip:
  """yaml
  lifecycle:
    before:
      - cache:
          handler: checkCache
          timeout: 500
          onTimeout: "skip"
  """
And checkCache takes 1000ms to complete
When the lifecycle executes
Then checkCache is cancelled after 500ms
And no error is thrown
And no warning is logged
And execution continues immediately
```

### Scenario: Timeout precedence hierarchy
```gherkin
Given a global timeout configuration:
  """yaml
  timeouts:
    phases:
      before: 5000
    handlers:
      platform.auth: 3000
  """
And a manifest with hook-level timeout:
  """yaml
  lifecycle:
    before:
      - auth:
          handler: platform.auth
          timeout: 2000
  """
When the lifecycle executes
Then timeout = 2000ms (hook-level overrides handler-level 3000ms)
And handler-level would override phase-level 5000ms
```

### Scenario: Timeout with retry integration
```gherkin
Given a manifest with timeout and retry:
  """yaml
  lifecycle:
    before:
      - fetch:
          handler: queryAPI
          timeout: 3000
          errorHandling:
            - type: timeout
              retryable: true
              maxRetries: 2
  """
And queryAPI times out on attempts 1 and 2
And queryAPI succeeds on attempt 3
When the lifecycle executes
Then attempt 1 times out → retry
And attempt 2 times out → retry
And attempt 3 succeeds within timeout
And execution continues
```

---

## Feature 3: Conditional Execution

### Scenario: Simple expression evaluates to true
```gherkin
Given a manifest with conditional handler:
  """yaml
  lifecycle:
    before:
      - auth:
          handler: platform.auth
          when: "context.jwt != null"
  """
And context.jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
When the lifecycle executes
Then platform.auth handler is executed
And condition evaluation takes < 1ms
```

### Scenario: Simple expression evaluates to false
```gherkin
Given a manifest with conditional handler:
  """yaml
  lifecycle:
    before:
      - auth:
          handler: platform.auth
          when: "context.jwt != null"
  """
And context.jwt = undefined
When the lifecycle executes
Then platform.auth handler is skipped
And telemetry event "lifecycle.condition.skipped" is emitted
And execution continues to next handler
```

### Scenario: Complex boolean logic with AND
```gherkin
Given a manifest with complex condition:
  """yaml
  lifecycle:
    before:
      - advancedCheck:
          handler: validateHighValue
          when:
            and:
              - "context.user.role == 'admin'"
              - "context.inputs.amount > 10000"
  """
And context.user.role = "admin"
And context.inputs.amount = 15000
When the lifecycle executes
Then both conditions evaluate to true
And validateHighValue handler is executed
```

### Scenario: Complex boolean logic with OR
```gherkin
Given a manifest with OR condition:
  """yaml
  lifecycle:
    before:
      - specialAccess:
          handler: grantAccess
          when:
            or:
              - "context.user.role == 'admin'"
              - "context.emergencyOverride == true"
  """
And context.user.role = "user"
And context.emergencyOverride = true
When the lifecycle executes
Then grantAccess handler is executed
```

### Scenario: Optional chaining prevents errors
```gherkin
Given a manifest with optional chaining:
  """yaml
  lifecycle:
    before:
      - roleCheck:
          handler: validateRole
          when: "context.user?.roles?.includes('admin')"
  """
And context.user = undefined
When the lifecycle executes
Then expression evaluates to false (no error)
And validateRole handler is skipped
```

### Scenario: Environment variable access
```gherkin
Given a manifest with environment check:
  """yaml
  lifecycle:
    before:
      - featureFlag:
          handler: newFeature
          when: "env.FEATURE_NEW_VALIDATION == 'true'"
  """
And process.env.FEATURE_NEW_VALIDATION = "true"
When the lifecycle executes
Then newFeature handler is executed
```

### Scenario: Invalid expression caught at manifest validation
```gherkin
Given a manifest with invalid expression:
  """yaml
  lifecycle:
    before:
      - broken:
          handler: test
          when: "context.user.role =="  # Syntax error
  """
When the manifest is validated
Then ManifestValidationError is thrown
And error message contains: "Invalid condition in hook 'broken'"
And error message contains syntax details
```

### Scenario: Debug mode logs condition evaluation
```gherkin
Given a manifest with debug enabled:
  """yaml
  lifecycle:
    before:
      - adminCheck:
          handler: checkAdmin
          when: "context.user?.roles?.includes('admin')"
          debugCondition: true
  """
And context.user.roles = ["user", "viewer"]
When the lifecycle executes
Then debug log is output:
  """
  [DEBUG] Condition 'context.user?.roles?.includes('admin')' evaluated to false
    - context.user.roles = ['user', 'viewer']
    - includes('admin') = false
  Result: Skip handler 'checkAdmin'
  """
```

---

## Feature 4: Inter-Hook Communication

### Scenario: Hook declares outputs
```gherkin
Given a manifest with typed outputs:
  """yaml
  lifecycle:
    before:
      - validate:
          handler: checkSchema
          outputs:
            - name: validationResult
              type: boolean
              required: true
            - name: errors
              type: array<string>
              required: false
  """
When checkSchema executes and returns:
  """
  { validationResult: true, errors: [] }
  """
Then outputs are stored: context.hookOutputs.validate = { validationResult: true, errors: [] }
And output types are validated
And TypeScript interface is generated:
  """typescript
  export interface ValidateOutputs {
    validationResult: boolean;
    errors?: string[];
  }
  """
```

### Scenario: Hook declares inputs from previous output
```gherkin
Given a manifest with typed inputs:
  """yaml
  lifecycle:
    before:
      - validate:
          outputs: [{ name: result, type: boolean }]
      - logResult:
          inputs: [{ name: valid, from: result, required: true }]
  """
And validate returns: { result: true }
When logResult executes
Then inputs are resolved: { valid: true }
And logResult handler receives inputs parameter
```

### Scenario: Explicit namespace resolves conflicts
```gherkin
Given a manifest with name collision:
  """yaml
  lifecycle:
    before:
      - hookA:
          outputs: [{ name: result, type: string }]
      - hookB:
          outputs: [{ name: result, type: number }]
      - hookC:
          inputs:
            - { name: stringResult, from: hookA.result }
            - { name: numberResult, from: hookB.result }
  """
And hookA returns: { result: "success" }
And hookB returns: { result: 42 }
When hookC executes
Then inputs = { stringResult: "success", numberResult: 42 }
And no conflict occurs
```

### Scenario: Missing required output throws error
```gherkin
Given a manifest with required output:
  """yaml
  lifecycle:
    before:
      - validate:
          outputs:
            - name: result
              type: boolean
              required: true
  """
And validate returns: {}  # Missing result
When the lifecycle executes
Then error is thrown: "Required output 'result' missing"
And error phase is triggered
```

### Scenario: Missing required input throws error
```gherkin
Given a manifest with required input:
  """yaml
  lifecycle:
    before:
      - hookA:
          outputs: [{ name: data, type: string }]
      - hookB:
          inputs: [{ name: requiredData, from: data, required: true }]
  """
And hookA returns: {}  # Missing data
When hookB attempts to execute
Then error is thrown: "Required input 'requiredData' not found"
And error phase is triggered
```

### Scenario: Output type mismatch throws error
```gherkin
Given a manifest with typed output:
  """yaml
  lifecycle:
    before:
      - validate:
          outputs:
            - name: result
              type: boolean
  """
And validate returns: { result: "true" }  # String instead of boolean
When the lifecycle validates outputs
Then error is thrown: "Output 'result' type mismatch: expected boolean, got string"
```

### Scenario: Circular dependency detected at validation
```gherkin
Given a manifest with circular dependency:
  """yaml
  lifecycle:
    before:
      - hookA:
          inputs: [{ from: hookB.result }]
          outputs: [{ name: result, type: string }]
      - hookB:
          inputs: [{ from: hookA.result }]
          outputs: [{ name: result, type: string }]
  """
When the manifest is validated
Then ManifestValidationError is thrown
And error message contains: "Circular dependencies detected"
And error message shows cycle: "hookA → hookB → hookA"
```

### Scenario: TypeScript code generation creates interfaces
```gherkin
Given a manifest with multiple hooks:
  """yaml
  lifecycle:
    before:
      - validate:
          outputs:
            - { name: valid, type: boolean, required: true }
            - { name: errors, type: array<string>, required: false }
      - log:
          inputs:
            - { name: isValid, from: valid, required: true }
  """
When "mfe generate-types" command is run
Then src/generated/interfaces.ts is created with:
  """typescript
  export interface ValidateOutputs {
    valid: boolean;
    errors?: string[];
  }
  
  export interface LogInputs {
    isValid: boolean;
  }
  
  export type ValidateHandler = (ctx: Context) => Promise<ValidateOutputs>;
  export type LogHandler = (ctx: Context, inputs: LogInputs) => Promise<void>;
  """
```

---

## Feature 5: Error Classification & Handling

### Scenario: Typed error detected and retried
```gherkin
Given a manifest with retry configuration:
  """yaml
  lifecycle:
    before:
      - fetch:
          handler: queryAPI
          errorHandling:
            - type: network
              retryable: true
              maxRetries: 3
              backoff: exponential
              baseDelay: 1000
  """
And queryAPI throws NetworkError on attempt 1
And queryAPI succeeds on attempt 2
When the lifecycle executes
Then attempt 1 fails → wait 1000ms → retry
And attempt 2 succeeds
And telemetry tracks retry event
```

### Scenario: Exponential backoff calculation
```gherkin
Given retry configuration:
  """yaml
  errorHandling:
    - type: network
      maxRetries: 3
      backoff: exponential
      baseDelay: 1000
      maxDelay: 10000
      jitter: false
  """
When handler fails 3 times
Then retry delays are:
  | Attempt | Delay |
  | 1       | 1000ms |
  | 2       | 2000ms |
  | 3       | 4000ms |
```

### Scenario: Jitter prevents thundering herd
```gherkin
Given retry configuration with jitter:
  """yaml
  errorHandling:
    - type: network
      backoff: exponential
      baseDelay: 1000
      jitter: true
  """
When handler fails 5 times
Then each retry delay has ±20% random jitter
And no two concurrent retries have identical delays
```

### Scenario: Pattern matching for third-party errors
```gherkin
Given a manifest with pattern matching:
  """yaml
  lifecycle:
    before:
      - fetch:
          handler: legacyAPI
          errorHandling:
            - pattern: "ECONNREFUSED|ETIMEDOUT"
              type: network
              retryable: true
  """
And legacyAPI throws Error("ETIMEDOUT")
When the lifecycle executes
Then error is classified as 'network'
And retry is attempted
```

### Scenario: onRetry hook modifies context
```gherkin
Given a manifest with onRetry hook:
  """yaml
  lifecycle:
    before:
      - fetch:
          handler: queryAPI
          errorHandling:
            - type: network
              maxRetries: 2
              onRetry: adjustContext
  """
And adjustContext increases timeout on each retry
When queryAPI fails twice then succeeds
Then context.timeout increases: 3000ms → 4500ms → 6750ms
And onRetry hook called before each retry
```

### Scenario: Fallback handler with modified context
```gherkin
Given a manifest with fallback:
  """yaml
  lifecycle:
    before:
      - auth:
          handler: fetchLiveAuth
          errorHandling:
            - type: network
              maxRetries: 2
              fallbackHandler: useCachedAuth
  """
And fetchLiveAuth fails after 2 retries
When lifecycle executes fallback
Then context.fallback = { active: true, reason: 'network', retriesExhausted: 2 }
And useCachedAuth receives modified context
And cached auth data is used
```

### Scenario: User-facing error sanitization
```gherkin
Given a manifest with validation error:
  """yaml
  lifecycle:
    before:
      - validate:
          errorHandling:
            - type: validation
              userFacing: true
              message: "Invalid product selection"
  """
And validate throws ValidationError("Product ID 12345 not found in inventory")
When error is returned to user
Then user sees:
  """json
  {
    "error": {
      "type": "validation",
      "message": "Invalid product selection",
      "code": "ERR_VALIDATION"
    }
  }
  """
And internal logs contain full stack trace
```

### Scenario: Security error audit logging
```gherkin
Given a manifest with security error:
  """yaml
  lifecycle:
    before:
      - auth:
          errorHandling:
            - type: security
              auditLog: true
              userMessage: "Access denied"
  """
And auth throws SecurityError("Invalid JWT signature for user 123")
When error occurs
Then user sees: { error: { type: 'security', message: 'Access denied' } }
And audit log receives:
  """json
  {
    "event": "security_error",
    "user": { "id": 123 },
    "error": "Invalid JWT signature for user 123",
    "timestamp": "2025-12-11T10:30:00Z"
  }
  """
```

---

## Integration Scenarios

### Scenario: Parallel execution + Timeout
```gherkin
Given a manifest combining parallel and timeout:
  """yaml
  lifecycle:
    before:
      - checks:
          handler: [checkA, checkB, checkC]
          parallel: true
          timeout: 2000
          failureStrategy: "complete-all"
  """
And checkB hangs for 3000ms
When the lifecycle executes
Then checkB times out after 2000ms
And checkA and checkC complete normally
And aggregated error includes timeout for checkB
```

### Scenario: Conditional + Error classification
```gherkin
Given a manifest combining conditional and error handling:
  """yaml
  lifecycle:
    before:
      - fetch:
          handler: queryAPI
          when: "context.jwt != null"
          errorHandling:
            - type: network
              retryable: true
              maxRetries: 2
  """
And context.jwt = undefined
When the lifecycle executes
Then queryAPI is skipped (condition false)
And no retry is attempted
```

### Scenario: Inter-hook communication + Timeout
```gherkin
Given a manifest with typed communication and timeout:
  """yaml
  lifecycle:
    before:
      - validate:
          handler: checkData
          timeout: 1000
          outputs: [{ name: result, type: boolean }]
      - process:
          handler: processData
          inputs: [{ name: valid, from: result, required: true }]
  ```
And checkData times out
When the lifecycle executes
Then checkData throws TimeoutError
And process is not executed (missing required input)
And error phase is triggered
```

---

**Status**: ✅ Ready for Implementation  
**Total Scenarios**: 35  
**Coverage**: All 5 enhancements + integration scenarios
