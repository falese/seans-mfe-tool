/**
 * Typed result interfaces for every command.
 * BaseCommand threads the return value of runCommand() into
 * CommandResult<T>.data under --json mode.
 *
 * Refs #102 (B3), #107 (B8 adds MutatingResult mixin)
 */

import type { BuildError } from '@seans-mfe/contracts';

// BFF result types live in @seans-mfe/plugin-bff (migrated in plugin extraction epic)
export type {
  BffInitResult,
  BffBuildResult,
  BffDevResult,
  BffValidateResult,
  BffValidationIssue,
} from '@seans-mfe/plugin-bff';

// ---------------------------------------------------------------------------
// Shared mixin
// ---------------------------------------------------------------------------

// The dry-run mixin is part of the envelope vocabulary, not any one command's
// result, so it is defined once in @seans-mfe/contracts and re-exported here
// for the commands that already import it from this module (ADR-080).
export type { MutatingResult, PlannedChange } from '@seans-mfe/contracts';
import type { MutatingResult } from '@seans-mfe/contracts';
import type { ProposalStatus } from '@seans-mfe/decompose';

// ---------------------------------------------------------------------------
// api
// ---------------------------------------------------------------------------

// The api result type lives in @seans-mfe/plugin-api (ADR-063), re-exported
// here so callers keep one import site — same as the BFF types above.
export type { ApiResult } from '@seans-mfe/plugin-api';

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
  /**
   * Developer-owned files that existed and were replaced because `--force` was
   * passed (ADR-091). Empty on every run without the flag.
   */
  reseeded: string[];
}

// ---------------------------------------------------------------------------
// remote:generate:capability
// ---------------------------------------------------------------------------

export interface RemoteGenerateCapabilityResult extends MutatingResult {
  capabilityName: string;
  generated: string[];
  skipped: string[];
  errors: string[];
  /**
   * Developer-owned files that existed and were replaced because `--force` was
   * passed (ADR-091). Empty on every run without the flag.
   *
   * Present for the same reason it is on `RemoteGenerateResult`: this command
   * forwards `--force` to the same writer, so it reaches the same files, and a
   * caller that cannot tell a re-seed from a first write cannot warn about it.
   */
  reseeded: string[];
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

/** One target's production build (ADR-097). */
export interface TargetBuild {
  targetId: string;
  plugin: string;
  framework: string;
  bundler: string;
  success: boolean;
  artifacts: string[];
  duration_ms: number;
}

export interface BuildProdResult {
  /** Every build this manifest declares, primary first (ADR-095). */
  targets: TargetBuild[];
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

// ---------------------------------------------------------------------------
// design:export
// ---------------------------------------------------------------------------

/** design:export — captured design bundle summary (POC). */
export interface DesignExportResult {
  url: string;
  outDir: string;
  name: string;
  stats: {
    elements: number;
    texts: number;
    images: number;
    placeholders: number;
    truncated: number;
  };
  fonts: Array<{ family: string; weight: number; italic: boolean }>;
  files: string[];
}

/**
 * sentinel:validate — one kernel run over one root through SMT's ports
 * (ADR-089, #384). `hits` are HardenedCheck findings in developer-owned code;
 * they are advice and never fail the run. An invalid artifact does.
 */
export interface SentinelValidateResult {
  root: string;
  ok: boolean;
  artifacts: Array<{
    /** Relative to the root. */
    path: string;
    valid: boolean;
    errors: Array<{ path: string; message: string; code?: string }>;
  }>;
  /** How many HardenedChecks ran. */
  checks: number;
  /** Developer-owned source files the checks ran over. */
  scanned: number;
  hits: Array<{
    /** The HardenedCheck's id. */
    check: string;
    /** The decision it enforces, e.g. `ADR-017`. */
    enforces: string;
    message: string;
    fix: string;
    /** `path:line`, relative to the root. */
    location: string;
    text: string;
  }>;
}

// ---------------------------------------------------------------------------
// decompose:capture
// ---------------------------------------------------------------------------

/** decompose:capture — an evidence bundle written (ADR-109). */
export interface DecomposeCaptureResult {
  url: string;
  outDir: string;
  /** Names of the journeys that ran, `explore` included. */
  journeys: string[];
  mode: 'live' | 'replay';
  clock: string;
  stats: {
    steps: number;
    regions: number;
    requests: number;
    attributedRequests: number;
    sourceCoverage: { visibleElements: number; mappedToSource: number };
    consoleErrors: number;
    pageErrors: number;
  };
  /** Requests a replay had no recording for, as `METHOD url`. */
  replayMisses: string[];
  files: string[];
}

// ---------------------------------------------------------------------------
// decompose:analyze
// ---------------------------------------------------------------------------

/** decompose:analyze — the source graph written, joined to an evidence bundle when given (ADR-109 §3). */
export interface DecomposeAnalyzeResult {
  dir: string;
  outDir: string;
  sourceFiles: number;
  /** Files per assignment category: screen, shared, shell, unreached. */
  assignment: Record<string, number>;
  routes: number;
  endpoints: number;
  storeReads: number;
  tests: { files: number; ran: boolean; reason: string | null; passed: number; failed: number; skipped: number };
  history: { coChangePairs: number; ownedFiles: number; unavailable: string | null };
  join: {
    observedEndpoints: number;
    explained: number;
    unexplained: number;
    sourceOnly: number;
    filesSeenAtRuntime: number;
    sourceFiles: number;
  } | null;
  files: string[];
}

// ---------------------------------------------------------------------------
// decompose:propose
// ---------------------------------------------------------------------------

/** decompose:propose — a decomposition proposed (or re-derived), with its derived fleet validated (ADR-110). */
export interface DecomposeProposeResult {
  outDir: string;
  mode: 'clustered' | 'rederived';
  domains: Array<{ id: string; mfe: string; files: number; capabilities: string[]; backends: string[] }>;
  shared: string[];
  unassigned: string[];
  couplings: number;
  tests: { keep: number; rewrite: number; discard: number };
  uncovered: number;
  /** Manifest errors per MFE and fatal composition findings; empty when everything validates. */
  validation: { manifests: Record<string, string[]>; composition: Array<{ rule: string; message: string }> };
  valid: boolean;
  /** One OpenAPI document per backend the BFFs front (ADR-112); empty when there was no traffic or spec to read. */
  specs: DecomposeSpecSummary[];
  files: string[];
}

/** A backend's spec: where it came from, whether it validates, and how an inferred one differs from a published one. */
export interface DecomposeSpecSummary {
  backend: string;
  source: 'inferred' | 'published';
  operations: number;
  /** OpenAPI validation errors; empty when the document is valid. */
  errors: string[];
  differences?: {
    operationsMatched: number;
    inferredOnly: string[];
    publishedOnly: string[];
    fieldsMatched: number;
    fieldsInferredOnly: number;
    fieldsPublishedOnly: number;
    typeMismatches: string[];
  };
}

// ---------------------------------------------------------------------------
// decompose:verify
// ---------------------------------------------------------------------------

/** decompose:verify — the parity gate run (ADR-113). A run not at parity fails with PARITY_FAILED; the report is on disk. */
export interface DecomposeVerifyResult {
  baseline: string;
  candidate: string;
  /** The app driven; null when an existing bundle was compared. */
  url: string | null;
  parity: boolean;
  summary: {
    steps: number;
    stepsAtParity: number;
    regions: number;
    regionsAtParity: number;
    requests: number;
    newConsoleErrors: number;
    visualFailures: number;
  };
  failingSteps: string[];
  /** Behavior no journey exercised: routes never visited. */
  gaps: { routes: string[] };
  replayMisses: string[];
  report: { json: string; markdown: string };
}

// ---------------------------------------------------------------------------
// decompose:score
// ---------------------------------------------------------------------------

/** One proposal scored against an answer key. */
export interface DecompositionScoreSummary {
  domainMap: Record<string, string | null>;
  assignment: { correct: number; total: number; precision: number; recall: number; f1: number; misplaced: Array<{ file: string; proposed: string; expected: string }> };
  backends: { perDomain: Record<string, number>; mean: number };
  slots: { slotMap: Record<string, string>; matched: number; total: number; score: number };
  tests: { agree: number; total: number; score: number; disagreements: Array<{ file: string; proposed: string; expected: string }> };
  gaps: { detected: string[]; missed: string[]; unmatchable: string[]; recall: number };
}

/** decompose:score — the proposal and, when there is one, its deterministic base, scored (#415). */
export interface DecomposeScoreResult {
  proposal: string;
  answerKey: string;
  score: DecompositionScoreSummary;
  /** The deterministic draft scored alone, when proposal.base.yaml is beside the proposal (or --base). */
  base: DecompositionScoreSummary | null;
  /** The agent's edits from base to proposal. */
  edits: Array<Record<string, string>>;
  /** The training-corpus record written, when --corpus was given. */
  corpusRecord: string | null;
}

// ---------------------------------------------------------------------------
// decompose:edit
// ---------------------------------------------------------------------------

/** decompose:edit — named edits applied to a proposal, and the fleet re-derived (ADR-110 §4). */
export interface DecomposeEditResult {
  proposal: string;
  edits: Array<Record<string, string>>;
  domains: string[];
  /** Whether a recorded approval still names the edited document (ADR-116 §5). */
  approval: 'none' | 'current' | 'stale';
  /** Agent suggestions still waiting for a decision. */
  suggestions: number;
  validation: { manifests: Record<string, string[]>; composition: Array<{ rule: string; message: string }> };
  valid: boolean;
  /** True when the edits were only applied and validated, not written (ADR-117 §4). */
  dryRun: boolean;
  /** What was written; empty on a dry run. */
  files: string[];
}

// ---------------------------------------------------------------------------
// flow:status --proposal (was decompose:status)
// ---------------------------------------------------------------------------

export interface FlowProposalStatus extends ProposalStatus {
  /** The decomposition.yaml read. */
  proposal: string;
  /** The evidence bundle the screens' screenshot paths are relative to; null without one. */
  bundle: string | null;
}

// ---------------------------------------------------------------------------
// decompose:present
// ---------------------------------------------------------------------------

/** decompose:present — the agreement artifact: PROPOSAL.md and the boundary overlay (#416). */
export interface DecomposePresentResult {
  proposalDir: string;
  /** Screens in the overlay, and domain boxes drawn on them. */
  screens: number;
  boxes: number;
  /** Domains with at least one box on some screen; the rest never appeared in the capture. */
  domainsShown: string[];
  domainsNotShown: string[];
  files: string[];
}

// ---------------------------------------------------------------------------
// decompose:scaffold (#417, ADR-111)
// ---------------------------------------------------------------------------

export interface DecomposeScaffoldMfe {
  name: string;
  dir: string;
  /** `domain`: one of the proposal's domains. `legacy`: the monolith, whole (ADR-111 §1). */
  role: 'domain' | 'legacy';
  capabilities: string[];
  /** Files the generator wrote, and developer-owned files it found and kept. */
  generated: number;
  kept: number;
}

export interface DecomposeScaffoldResult {
  fleetDir: string;
  app: string;
  namespace: string;
  /** The approval hash the fleet was scaffolded from (ADR-116 §5). */
  approvedHash: string;
  mfes: DecomposeScaffoldMfe[];
  legacy: { mfe: string; capability: string; remoteEntry: string };
  shell: { dir: string; port: number };
  /** The starting composition, its compiled payload, and the proposal's own composition. */
  controlPlane: string;
  rules: string;
  target: string;
  files: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// decompose:port (#419, ADR-126)
// ---------------------------------------------------------------------------

export interface DecomposePortResult {
  fleetDir: string;
  mfes: Array<{
    name: string;
    domain: string;
    /** Monolith files copied under the MFE's `src/monolith/`. */
    files: string[];
    /** Capabilities whose feature file renders the ported component; and those kept because a developer changed them. */
    capabilities: string[];
    kept: string[];
    /** Packages added to the MFE's package.json, at the monolith's versions. */
    packages: string[];
    /**
     * ADR-127, ADR-128: the endpoints the MFE's BFF fronts; the data functions (`file#name`) that
     * read through it when composed and run the monolith's code standalone; and those left on the
     * monolith's code in both modes, with why.
     */
    bff: { operations: string[]; inlined: string[]; monolith: string[] };
  }>;
  /** Shell route blocks that became declared slots, as `<file>: <slot>`. */
  slots: string[];
  /** Files copied into more than one MFE: shared code to split, duplicate or replace. */
  duplicated: Array<{ file: string; mfes: string[] }>;
  controlPlane: string;
  rules: string;
  /** The shell's path → state key table. */
  routes: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// decompose:workspace / decompose:ask (ADR-116, ADR-117, ADR-118)
// ---------------------------------------------------------------------------

export interface DecomposeWorkspaceResult {
  /** Where the workspace was served. */
  url: string;
  proposal: string;
  /** Each approval made while it ran, and whether it was committed. */
  approvals: Array<{ committed: true; commit: string } | { committed: false; reason: string }>;
}

/** The agent's answer, the edits written as suggestions, and the edits the check dropped, with why. */
export interface DecomposeAskResult {
  answer: string;
  suggested: Array<{ explanation: string; edit: Record<string, unknown> }>;
  dropped: Array<{ explanation: string; edit: Record<string, unknown>; reason: string }>;
  model: string;
}

// ---------------------------------------------------------------------------
// flow:status (PDR-012, ADR-119)
// ---------------------------------------------------------------------------

/** Where a directory stands in a flow, derived from its files. */
export interface FlowStatusResult {
  flow: string;
  title: string;
  /** The directory, resolved. */
  root: string;
  steps: Array<{
    id: string;
    title: string;
    kind: 'command' | 'gate' | 'optional';
    state: 'done' | 'stale' | 'next' | 'ready' | 'waiting' | 'blocked' | 'optional' | 'unavailable';
    detail?: string;
    command?: string;
  }>;
  /** The command to run next, or null when nothing can run. */
  next: { step: string; command: string; placeholders: string[] } | null;
  summary: string;
  /** The proposal as the workspace reads it (ADR-116 §3); only with `--proposal`. */
  proposal?: FlowProposalStatus;
}

// ---------------------------------------------------------------------------
// test:generate (PDR-014, ADR-129)
// ---------------------------------------------------------------------------

/** What test:generate wrote into one MFE. */
export interface GeneratedMfeTestsSummary {
  mfe: string;
  dir: string;
  /** Capabilities with an alone (jsdom) test, and how many captured states each covers. */
  alone: Array<{ capability: string; cases: number }>;
  /** Capabilities with no alone test, and why. */
  skipped: Array<{ capability: string; reason: string }>;
  /** The Playwright journey spec: journeys, per-step capability checks, visual baselines. */
  journeys: { journeys: number; checks: number; baselines: number };
  /** BFF operations with a contract test, and those no recording covers. */
  contract: { operations: number; unrecorded: string[] };
  /** The monolith's tests: moved (keep), replaced by characterization (rewrite), dropped (discard). */
  migrated: { kept: string[]; rewritten: Array<{ file: string; reasons: string[] }>; discarded: Array<{ file: string; reasons: string[] }> };
  /** Files written, relative to the MFE. */
  written: string[];
  /** Files left as a developer changed them. */
  kept: string[];
  /** What could not be generated, with why. */
  warnings: string[];
  /** The MFE's TESTS.md. */
  report: string;
}

export interface TestGenerateResult {
  evidence: string;
  mfes: GeneratedMfeTestsSummary[];
}
