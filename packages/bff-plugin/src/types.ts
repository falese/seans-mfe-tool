/**
 * Typed result interfaces for BFF commands.
 * Moved from src/oclif/results.ts in the BFF plugin extraction epic (Issue #125).
 * src/oclif/results.ts now re-exports these types from this module.
 */

import type { MeshConfig, MFEManifest } from './shared';

// ---------------------------------------------------------------------------
// MutatingResult mixin — duplicated here so the plugin is self-contained.
// The canonical definition lives in src/oclif/results.ts; these are
// structurally identical and therefore compatible at the TypeScript level.
// ---------------------------------------------------------------------------

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
  meshConfig: MeshConfig;
  manifest: MFEManifest;
}

export interface BffValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}
