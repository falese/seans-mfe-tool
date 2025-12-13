# REQ-047: Unified Type System

Feature: Unified type system across DSL → GraphQL → TypeScript/Python
  As a platform developer
  I want consistent type parsing, generation, and validation
  So that MFEs have reliable schemas and runtime checks

  # Happy path
  Scenario: Parse simple required type
    Given a DSL type string "string!"
    When the type is parsed
    Then the result indicates baseType "string" and isRequired true

  Scenario: Parse nested array type with non-null items
    Given a DSL type string "array<User!>!"
    When the type is parsed
    Then the result indicates baseType "array", itemType baseType "User" with isRequired true, and array isRequired true

  Scenario: Generate GraphQL type from DSL
    Given a parsed type for "array<User!>!"
    When generating GraphQL type
    Then the result is "[User!]!"

  Scenario: Generate TypeScript type from DSL
    Given a parsed type for "string"
    When generating TypeScript type
    Then the result is "string | null"

  Scenario: Generate Python type from DSL
    Given a parsed type for "string!"
    When generating Python type
    Then the result is "str"

  # Validation
  Scenario: Generate Zod schema for constrained type
    Given a DSL type "string!" with constraints minLength: 3 and maxLength: 10
    When generating Zod schema
    Then the schema enforces required with length bounds

  Scenario: Runtime validation passes for valid value
    Given a parsed type for "array<string!>!" with minLength: 1
    When validating the value ["a", "b"]
    Then validation succeeds

  Scenario: Runtime validation fails with detailed errors
    Given a parsed type for "array<string!>!" with minLength: 1
    When validating the value []
    Then validation fails with message indicating minimum length violation

  # Specialized types
  Scenario: Validate JWT type
    Given a parsed type for "jwt!"
    When validating a well-formed JWT value
    Then validation succeeds and decodes claims as needed

  Scenario: Validate email type
    Given a parsed type for "email!"
    When validating an invalid email
    Then validation fails with an email format error

  # Error cases
  Scenario: Invalid DSL type fails parsing
    Given a DSL type string "array<>!"
    When parsing the type
    Then an error is raised indicating an invalid item type

  Scenario: Build fails on invalid constraints
    Given a DSL type "string!" with minLength: -1
    When generating Zod schema
    Then an error is raised indicating invalid constraint configuration
