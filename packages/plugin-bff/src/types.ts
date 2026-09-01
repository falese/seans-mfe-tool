/**
 * Typed result interfaces for BFF commands.
 * Moved from src/oclif/results.ts in the BFF plugin extraction epic (Issue #125).
 * src/oclif/results.ts now re-exports these types from this module.
 */

import type { MeshConfig, MFEManifest } from './shared';

// ---------------------------------------------------------------------------
// The dry-run mixin comes from @seans-mfe/contracts — one definition shared
// by the CLI and every plugin (ADR-080). It used to be copied here.
export type { MutatingResult, PlannedChange } from '@seans-mfe/contracts';
import type { MutatingResult } from '@seans-mfe/contracts';

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
