/**
 * Typed result interfaces for every command.
 * BaseCommand threads the return value of runCommand() into
 * CommandResult<T>.data under --json mode.
 *
 * Refs #102 (B3), #107 (B8 adds MutatingResult mixin)
 */

import type { BuildError } from '@seans-mfe/contracts';

// BFF result types live in @falese/bff-plugin (migrated in plugin extraction epic)
export type {
  BffInitResult,
  BffBuildResult,
  BffDevResult,
  BffValidateResult,
  BffValidationIssue,
} from '@falese/bff-plugin';

// ---------------------------------------------------------------------------
// Shared mixin
// ---------------------------------------------------------------------------

// The dry-run mixin is part of the envelope vocabulary, not any one command's
// result, so it is defined once in @seans-mfe/contracts and re-exported here
// for the commands that already import it from this module (ADR-080).
export type { MutatingResult, PlannedChange } from '@seans-mfe/contracts';
import type { MutatingResult } from '@seans-mfe/contracts';

// ---------------------------------------------------------------------------
// deploy
// ---------------------------------------------------------------------------

export interface DeployResult extends MutatingResult {
  appName: string;
  environment: 'development' | 'production';
  containerId?: string;
  ports: number[];
  generatedFiles: string[];
  mode?: string;
}

// ---------------------------------------------------------------------------
// api (create-api)
// ---------------------------------------------------------------------------

export interface ApiResult extends MutatingResult {
  name: string;
  database: string;
  port: number;
  generatedFiles: string[];
}

// ---------------------------------------------------------------------------
// remote:init
// ---------------------------------------------------------------------------

export interface RemoteInitResult extends MutatingResult {
  name: string;
  port: number;
  targetDir: string;
  generatedFiles: string[];
}

// ---------------------------------------------------------------------------
// remote:generate
// ---------------------------------------------------------------------------

export interface RemoteGenerateResult extends MutatingResult {
  generated: string[];
  skipped: string[];
  errors: string[];
  /** Capability names whose feature files were preserved (already implemented). */
  preserved: string[];
}

// ---------------------------------------------------------------------------
// remote:generate:capability
// ---------------------------------------------------------------------------

export interface RemoteGenerateCapabilityResult extends MutatingResult {
  capabilityName: string;
  generated: string[];
  skipped: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// build:dev (ADR-036, #174)
// ---------------------------------------------------------------------------

export interface BuildDevResult {
  plugin: string;
  framework: string;
  bundler: string;
  url: string;
  port: number;
}

// ---------------------------------------------------------------------------
// build:docker (ADR-036, #177)
// ---------------------------------------------------------------------------

export interface BuildDockerResult {
  plugin: string;
  framework: string;
  bundler: string;
  dockerfilePath: string;
  imageTag?: string;
  built: boolean;
}

// ---------------------------------------------------------------------------
// build:prod (ADR-036, #175)
// ---------------------------------------------------------------------------

export interface BuildProdResult {
  plugin: string;
  framework: string;
  bundler: string;
  success: boolean;
  artifacts: string[];
  duration_ms: number;
  warnings: string[];
  // `BuildError` itself, not a copy of its fields. The inline restatement this
  // replaces had already fallen behind: no `code`, and `category: string`
  // instead of the union, so the published schema advertised a free-form
  // string where the contract has six known values.
  errors: BuildError[];
}

export interface MfeValidateResult {
  mfe: string;
  framework: string;
  ok: boolean;
  checked: string[];
  issues: Array<{
    rule: string;
    message: string;
    package?: string;
    expected?: string;
    actual?: string;
    /** `warning` reports without failing; absent means `error` (ADR-082). */
    severity?: 'error' | 'warning';
    /** `path:line`, for issues found in a specific source file. */
    location?: string;
    /** What to do about it, for rules that can say. */
    fix?: string;
  }>;
  typecheck?: {
    ran: boolean;
    ok: boolean;
    output?: string;
  };
}
