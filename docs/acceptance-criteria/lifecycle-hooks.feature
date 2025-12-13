# REQ-042 to REQ-045, REQ-054 to REQ-056: Lifecycle Hook Execution & BaseMFE

Feature: Lifecycle hook execution semantics and BaseMFE orchestration
  As a developer using the MFE runtime
  I want hooks to execute with defined semantics
  So that capabilities run reliably with proper error handling and telemetry

  # Happy path: full lifecycle order
  Scenario: Execute hooks in order: before → main → after
    Given a BaseMFE subclass with a capability "query"
    And the DSL defines lifecycle hooks: before=[validateInputs], main=[runQuery], after=[logTelemetry]
    When the capability "query" executes
    Then the hook "validateInputs" runs before the main phase
    And the hook "runQuery" runs in the main phase
    And the hook "logTelemetry" runs after the main phase

  # Error path: main phase failure propagates
  Scenario: Main phase failure is propagated to caller
    Given the main phase hook "runQuery" throws an error
    When the capability "query" executes
    Then the runtime emits telemetry for the failure with severity "error"
    And the error is propagated to the caller
    And the after phase hooks do not run

  # Non-main failures: contained/mandatory handling
  Scenario: Non-main phase failures are contained and logged
    Given the before hook "validateInputs" throws an error marked contained: true
    When the capability "query" executes
    Then the runtime logs the error and emits telemetry with severity "warn"
    And the main phase continues to execute

  Scenario: Mandatory hooks execute regardless of prior failures
    Given a before hook "auth" with mandatory: true
    And a previous before hook failed
    When the capability "query" executes
    Then the mandatory hook "auth" still executes

  # Handler arrays
  Scenario: Handler array executes sequentially in non-main phases
    Given a before lifecycle with handlers [hookA, hookB]
    And hookA fails
    When the capability executes
    Then hookB still executes
    And failures are logged but do not stop the chain

  Scenario: Handler array short-circuits on first failure in main phase
    Given a main lifecycle with handlers [step1, step2]
    And step1 fails
    When the capability executes
    Then step2 does not execute
    And the error from step1 is propagated to the caller

  # State machine
  Scenario: Valid state transitions for capability execution
    Given the MFE state is "ready"
    When the capability begins execution
    Then state transitions to "rendering"
    And after completion, state transitions back to "ready"

  Scenario: Invalid state transitions are rejected
    Given the MFE state is "error"
    When attempting to transition directly to "rendering"
    Then the runtime throws a state transition error

  # BaseMFE contract
  Scenario: BaseMFE provides 9 platform capabilities
    Given a BaseMFE subclass
    When inspecting implemented methods
    Then methods for load, render, refresh, authorizeAccess, health, describe, schema, query, emit exist

  Scenario: Context object flows through lifecycle
    Given a Context object with inputs, outputs, jwt, and user
    When hooks and capability methods run
    Then they receive and can mutate the same Context object

  # Telemetry
  Scenario: Telemetry emitted on non-main failures
    Given a before hook fails
    When the capability executes
    Then a telemetry event is emitted with source "lifecycle-hook" and severity "warn"

  Scenario: Telemetry emitted on main failures
    Given a main hook fails
    When the capability executes
    Then a telemetry event is emitted with severity "error"
