/**
 * Sentinel — the reusable governance+generation kernel (PDR-010).
 *
 * The platform built one domain-agnostic pattern twice — a model reads wide,
 * emits a typed artifact, and a deterministic floor executes it — as generation
 * (ADR-084) and as governance (ADR-082). Sentinel is the machinery around that
 * shared contract, extracted so it can be reused and can govern its own records.
 *
 * This barrel is the kernel's public surface. It exports the port contract
 * (ADR-089) and the HardenedCheck floor, and nothing host-specific: a host
 * implements the ports as adapters over its own code, and imports *from* here —
 * never the reverse. Keeping this surface free of any `@seans-mfe/*` import is
 * what makes a later extraction to a neutral-identity peer repo mechanical.
 */

export type {
  PortValidationError,
  ValidationOutcome,
  ValidatePort,
  LocateArtifactsPort,
  MaterializedFile,
  MaterializePort,
  KernelPorts,
} from './ports';

export type { CheckHit, HostSource, HardenedCheck } from './hardened-check';
export { HardenedCheckSchema, verify } from './hardened-check';
