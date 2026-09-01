/**
 * Intent-compilation contract (ADR-085 §1, ADR-088).
 *
 * The typed in/out for the coder seam: a refined business intent plus repo
 * context goes in; a candidate `mfe-manifest.yaml` (as text) comes out. coder
 * is a replaceable implementation behind this boundary — invoked out-of-process
 * (subprocess or local SSE `serve`, ADR-019) — so nothing here imports a model,
 * weights, MLX, or Python.
 */

import type { ValidationResult } from '@seans-mfe/dsl';

/** The default coder adaptor that compiles intent → manifest (spec, issue #364). */
export const DEFAULT_ADAPTOR = 'intent-manifest';

/** The default `coder` binary name resolved on PATH for subprocess transport. */
export const DEFAULT_CODER_BIN = 'coder';

/**
 * Repo context handed to coder so the model reuses what the fleet already has
 * rather than reinventing it (ADR-085 §1: "available capabilities, fleet
 * manifests, the DSL schema"). All fields optional — an intent alone is valid.
 */
export interface RepoContext {
  /**
   * Capability names already provided across the fleet, so the generated
   * manifest can depend on them instead of duplicating them.
   */
  availableCapabilities?: string[];
  /**
   * Paths to files passed to coder as `--context` (fleet manifests, the DSL
   * schema excerpt, sibling manifests). Resolved and forwarded verbatim.
   */
  contextFiles?: string[];
}

/**
 * How the seam reaches the external coder service (ADR-019 out-of-process).
 *  - `subprocess`: spawn `coder generate …` and read the completion from stdout.
 *  - `serve`: POST the prompt to a running `coder serve` SSE endpoint.
 */
export type CoderTransport =
  | { kind: 'subprocess'; bin?: string }
  | { kind: 'serve'; endpoint: string };

/** Input to the seam: the compilation request. */
export interface IntentCompileRequest {
  /** The refined natural-language business intent. */
  intent: string;
  /** coder adaptor to select; defaults to {@link DEFAULT_ADAPTOR}. */
  adaptor?: string;
  /** Path to the DSL-grammar system prompt (`--system`), if any. */
  systemPromptPath?: string;
  /** MLX model dir/id to pass through (`--model`); coder's default otherwise. */
  model?: string;
  /** Fleet/DSL context forwarded to coder. */
  context?: RepoContext;
  /** Transport to the coder service; defaults to subprocess. */
  transport?: CoderTransport;
}

/** The candidate artifact coder emitted, fences stripped. */
export interface CandidateManifest {
  /** The `mfe-manifest.yaml` text as produced by coder (code fences removed). */
  yaml: string;
  /** The adaptor that produced it. */
  adaptor: string;
  /** The model coder ran, when known. */
  model?: string;
}

/**
 * Output of the seam: the candidate plus the oracle's verdict. `valid` mirrors
 * `validation.valid` for convenient branching on the {@link CommandResult}
 * envelope.
 */
export interface IntentCompileResult {
  candidate: CandidateManifest;
  validation: ValidationResult;
  valid: boolean;
  /** Where the manifest was written, when `--out` was given. */
  outPath?: string;
  /** Wall-clock time spent compiling (spawn/serve round-trip), in ms. */
  durationMs: number;
}

/**
 * The out-of-process boundary to coder. Injected so the seam is unit-testable
 * without a running model: a fake runner returns canned YAML; the real runners
 * ({@link makeSubprocessRunner}/{@link makeServeRunner}) spawn or fetch.
 */
export interface CoderRunner {
  /** Run the request against coder and return the raw completion text. */
  generate(request: IntentCompileRequest): Promise<string>;
}
