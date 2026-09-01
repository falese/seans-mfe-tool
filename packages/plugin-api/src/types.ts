/**
 * Result types for the api plugin's commands.
 *
 * They live with the command that returns them, the same way the BFF plugin's
 * result types moved when it was extracted — `src/oclif/results.ts` re-exports
 * them so callers in the CLI keep one import site.
 *
 * The `--dry-run` mixin comes from `@seans-mfe/contracts`: it belongs to the
 * envelope vocabulary rather than to any one command, and is shared by the CLI
 * and every plugin (ADR-080).
 */

import type { MutatingResult } from '@seans-mfe/contracts';

export interface ApiResult extends MutatingResult {
  name: string;
  database: string;
  port: number;
  generatedFiles: string[];
}
