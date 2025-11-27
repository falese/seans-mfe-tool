# Remote MFE DSL-First Workflow
# ADR References: ADR-048 (DSL-First), ADR-009/012 (Orchestration patterns), rspack/Module Federation integration

Feature: Remote MFE generation and runtime
  As a developer
  I want to scaffold a remote MFE from a DSL manifest
  So that capabilities are generated and the module runs via Module Federation

  Background:
    Given the CLI is available as `seans-mfe-tool`
    And a clean working directory at `/tmp/mfe-real-test`

  Scenario: Initialize a new remote project (happy path)
    When I run `seans-mfe-tool remote:init test-remote --port 3005`
    Then a project folder `test-remote` is created
    And files exist: `mfe-manifest.yaml`, `package.json`, `rspack.config.js`, `src/App.tsx`
    And `npm install` completes successfully

  Scenario: Update manifest with capabilities and generate files
    Given `mfe-manifest.yaml` contains `language: typescript`
    And `capabilities` is an array of record entries:
      | name         | type    | handler                                        |
      | UserProfile  | domain  | ./src/features/UserProfile/UserProfile         |
      | Dashboard    | domain  | ./src/features/Dashboard/Dashboard             |
    When I run `seans-mfe-tool remote:generate --force` in the project folder
    Then files are generated for each capability:
      | path                                           |
      | src/features/UserProfile/UserProfile.tsx       |
      | src/features/UserProfile/index.ts              |
      | src/features/UserProfile/UserProfile.test.tsx  |
      | src/features/Dashboard/Dashboard.tsx           |
      | src/features/Dashboard/index.ts                |
      | src/features/Dashboard/Dashboard.test.tsx      |
    And `src/remote.tsx` is created
    And `rspack.config.js` exposes the capabilities:
      | expose key      | local path                     |
      | ./UserProfile   | ./src/features/UserProfile     |
      | ./Dashboard     | ./src/features/Dashboard       |

  Scenario: Manifest validation error (edge case)
    Given a manifest where `capabilities` is an object instead of an array
    When I run `seans-mfe-tool remote:generate`
    Then the command fails with message containing "Manifest validation failed"
    And validation errors list `capabilities: Invalid input: expected array`

  Scenario: Run the remote dev server
    When I start `rspack serve` in the project folder
    Then the app serves `http://localhost:3005/`
    And the `remoteEntry.js` is available at `http://localhost:3005/remoteEntry.js`
    And the HTML contains `<div id="root"></div>`

  Scenario: Capability-specific generation
    Given the manifest defines `UserProfile` and `Dashboard`
    When I run `seans-mfe-tool remote:generate:capability UserProfile`
    Then only `src/features/UserProfile/*` files are generated or refreshed
    And `rspack.config.js` retains both exposes entries
