/**
 * Typed result interfaces for every command.
 * BaseCommand threads the return value of runCommand() into
 * CommandResult<T>.data under --json mode.
 *
 * Refs #102 (B3), #107 (B8 adds MutatingResult mixin)
 */

// ---------------------------------------------------------------------------
// Shared mixin
// ---------------------------------------------------------------------------

/** Mixin added to every mutating command result (B8). */
export interface MutatingResult {
  dryRun: boolean;
  plannedChanges?: PlannedChange[];
}

export interface PlannedChange {
  op: 'create' | 'overwrite' | 'skip' | 'spawn';
  target: string;
  detail?: string;
}

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
// bff:init
// ---------------------------------------------------------------------------

export interface BffInitResult extends MutatingResult {
  name: string;
  port: number;
  sources: string[];
  generatedFiles: string[];
}

// ---------------------------------------------------------------------------
// bff:build
// ---------------------------------------------------------------------------

export interface BffBuildResult extends MutatingResult {
  meshConfigPath: string;
  generatedFiles: string[];
}

// ---------------------------------------------------------------------------
// bff:dev
// ---------------------------------------------------------------------------

export interface BffDevResult {
  port: number;
  meshConfigPath: string;
}

// ---------------------------------------------------------------------------
// bff:validate
// ---------------------------------------------------------------------------

export interface BffValidateResult {
  valid: boolean;
  issues: BffValidationIssue[];
}

export interface BffValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
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
