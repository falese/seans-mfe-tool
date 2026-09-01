/**
 * The DSL eval oracle (ADR-088 §3, spec §6).
 *
 * Because this seam is a first-party in-repo package, its oracle imports the
 * DSL validator directly as a workspace dependency — the source of truth, no
 * publish gate, no shell-out, no duplicated schema. This is exactly the coupling
 * ADR-085 left open and ADR-088 resolved. The `intent-manifest` adaptor's eval
 * suite (#364) calls into here.
 */

import { load as parseYaml } from 'js-yaml';
import { validateFull, parseAndValidateDirectory, type ValidationResult } from '@seans-mfe/dsl';

// Re-export the DSL primitives so an eval suite (or the adaptor pack) can reach
// them through the seam rather than depending on @seans-mfe/dsl a second time.
export { validateFull, parseAndValidateDirectory } from '@seans-mfe/dsl';
export type { ValidationResult } from '@seans-mfe/dsl';

/**
 * Strip a leading/trailing Markdown code fence a model may wrap YAML in.
 * coder is prompted to emit bare YAML (spec §5), but strip defensively so one
 * stray fence never fails an otherwise-valid manifest.
 */
export function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/**
 * Validate a candidate manifest given as raw YAML text.
 *
 * Parses the (fence-stripped) YAML and runs the full DSL validation (schema +
 * semantics). A YAML parse failure is reported as a single validation error
 * rather than thrown, so the caller gets one uniform {@link ValidationResult}
 * to branch on.
 */
export function validateManifestText(text: string): ValidationResult {
  const stripped = stripFences(text);

  if (stripped.length === 0) {
    return {
      valid: false,
      errors: [{ path: '(root)', message: 'Empty manifest: coder returned no YAML' }],
    };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(stripped);
  } catch (err) {
    return {
      valid: false,
      errors: [{ path: '(root)', message: `YAML parse error: ${(err as Error).message}` }],
    };
  }

  return validateFull(parsed);
}

/**
 * Validate a manifest on disk by directory (the `parseAndValidateDirectory`
 * route from spec §6) — for callers that have already written `mfe-manifest.yaml`
 * into a directory and want the same parse coder's downstream pipeline uses.
 */
export async function validateManifestDirectory(
  directory: string,
): Promise<ValidationResult> {
  return parseAndValidateDirectory(directory);
}
