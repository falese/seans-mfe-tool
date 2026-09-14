/**
 * The kernel's ports (ADR-089).
 *
 * Sentinel is the reusable governance+generation kernel (PDR-010). It couples to
 * its host project through exactly these ports and nothing else: a host provides
 * an adapter for each, and the kernel provides the machinery behind them. The
 * pattern both instances share is one line — a model reads wide, emits a typed
 * artifact, and a deterministic floor executes it — and these ports are where the
 * host plugs its *own* domain in behind that floor.
 *
 * This file is pure and host-agnostic on purpose. It names no manifest, no
 * framework, no MFE, and imports nothing from the host. That is the ADR-089 §2
 * boundary made mechanical: if anything MFE-shaped were to appear here, the
 * kernel would no longer be reusable, and the claim that Sentinel governs its own
 * records as a genuine second instance (PDR-010) would be hollow. `Artifact` is a
 * type parameter precisely so the kernel never learns what the host's artifact is.
 */

/**
 * A validation problem the oracle reports. Structurally identical to the host's
 * own error shape by design — TypeScript's structural typing means the host's
 * value satisfies this without either side importing the other (the same reason
 * `SourceFile` in the ADR rules stays a two-field local interface).
 */
export interface PortValidationError {
  path: string;
  message: string;
  code?: string;
}

/** The deterministic oracle's verdict on one artifact (ADR-089 port 1). */
export interface ValidationOutcome {
  valid: boolean;
  errors: PortValidationError[];
}

/**
 * Port 1 — `validate(artifact)`: the deterministic oracle, and the crux port.
 *
 * It is what makes stochastic output safe to act on: a generated or model-audited
 * artifact is accepted only if this returns `valid`. The SMT adapter wraps
 * `validateFull` (`@seans-mfe/dsl`).
 */
export type ValidatePort<Artifact> = (
  artifact: Artifact,
) => ValidationOutcome | Promise<ValidationOutcome>;

/**
 * Port 2 — `locateArtifacts(root)`: discovery. Where the host's typed artifacts
 * live under a root. The SMT adapter wraps `findManifest` / `MANIFEST_FILENAMES`.
 */
export type LocateArtifactsPort = (root: string) => string[] | Promise<string[]>;

/**
 * A file an artifact materializes into (ADR-089 port 3).
 *
 * `overwrite` carries the ownership seam the host already lives by (ADR-082,
 * ADR-043): `true` = the generator owns and re-stamps it; `false` = seeded once
 * and thereafter the developer's. The kernel does not interpret the flag — it
 * carries it through so a host that has the seam does not lose it at the port.
 */
export interface MaterializedFile {
  path: string;
  content: string;
  overwrite: boolean;
}

/**
 * Port 3 — `materialize(artifact)`: optional. Turns an accepted artifact into
 * files. An audit-only host omits it (ADR-089 §3); this is the one optional port,
 * and only because audit-only use is a concrete, already-anticipated shape rather
 * than a speculative one. The SMT adapter wraps `generateAllFiles`.
 */
export type MaterializePort<Artifact> = (
  artifact: Artifact,
  basePath: string,
) => MaterializedFile[] | Promise<MaterializedFile[]>;

/**
 * The four ports a host implements as adapters over its own code (ADR-089 §1).
 *
 * `materialize` is optional. Nothing else is: this surface is drawn at exactly
 * what the host's existing gates already exercise (ADR-089 §3), so there is no
 * knob here for a domain no consumer has yet — every unused one would be a host
 * specific in disguise. The fourth port, the `HardenedCheck`, lives in
 * `./hardened-check` because it is a typed value with a verifier, not a function
 * signature.
 */
export interface KernelPorts<Artifact> {
  validate: ValidatePort<Artifact>;
  locateArtifacts: LocateArtifactsPort;
  materialize?: MaterializePort<Artifact>;
}
