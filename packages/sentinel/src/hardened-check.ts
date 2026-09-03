/**
 * The HardenedCheck — the fourth port, and the deterministic floor a governance
 * finding hardens into (ADR-089 port 4).
 *
 * This is the typed, usage-detectable check that catches drift *without* the
 * model, once someone has noticed the drift and written it down. Its shape is the
 * host's `PLATFORM_MIGRATIONS` entry (ADR-082) lifted to a port: a matcher, a
 * fix, and the decision it enforces. When Sentinel's drift auditor is built
 * (a later, still-Proposed decision under PDR-010), a `HardenedCheck` is the
 * *mechanizable* half of its typed output — the half that then hardens into plain code and needs the model
 * no more. The auditor never produces the floor; it only proposes candidate
 * checks a human accepts (PDR-010's Trusting-Trust guardrail).
 *
 * `verify` is that floor: ordinary, independently-tested code, matching per line
 * so a hit can be printed as `path:line`. The host's own verifier (SMT's
 * `mfe:validate`) is the adapter; this is the kernel's reference implementation of
 * the same contract.
 */

import { z } from 'zod';

/** One source line that trips a check. */
export interface CheckHit {
  /** 1-indexed, so it prints as `path:line`. */
  line: number;
  /** The offending line, trimmed — enough to recognise without opening the file. */
  text: string;
}

/** A source-like input a check verifies against. Two fields, structural. */
export interface HostSource {
  path: string;
  text: string;
}

/**
 * A hardened, usage-detectable drift check.
 *
 * Deliberately the `PLATFORM_MIGRATIONS` shape (ADR-082): detection is by *usage*
 * — "does this code still use the thing that moved" — not by staleness, so a check
 * reports exactly the code affected and goes quiet the moment it is fixed. `fix`
 * is the half a developer actually needs and a diff cannot derive, so it is
 * carried on the check itself.
 */
export interface HardenedCheck {
  /** Stable slug. Keys any suppression a consumer writes, so it must not churn. */
  id: string;
  /** What is wrong, in the developer's terms. */
  message: string;
  /** What to do instead — concrete enough to act on without reading the decision. */
  fix: string;
  /**
   * The decision-record id this enforces, e.g. `ADR-NNN`. Free-form on purpose:
   * the kernel does not own the host's record-numbering scheme.
   */
  enforces: string;
  /** Lines matching this are hits. Applied per line, so a hit carries a number. */
  pattern: RegExp;
  /**
   * Lines matching this are exempt even if `pattern` matched — for the cases a
   * single regex would over-match (ADR-082's `validation-error-renamed`).
   */
  exempt?: RegExp;
}

/**
 * The typed schema for a `HardenedCheck`.
 *
 * This is the narrow waist that makes a proposed check safe to accept (PDR-010's auditor loop):
 * it is at once the result format, an anti-hallucination bound (a proposal that
 * cannot be expressed in these fields is not a `HardenedCheck`), and the gate a
 * host runs a model-proposed check through before it hardens into code. `pattern`
 * and `exempt` are validated as real `RegExp` values, not strings, so a check
 * that parses is one `verify` can actually run.
 */
export const HardenedCheckSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1),
  fix: z.string().min(1),
  enforces: z.string().min(1),
  pattern: z.instanceof(RegExp),
  exempt: z.instanceof(RegExp).optional(),
});

/**
 * Run one `HardenedCheck` against one source — the deterministic floor.
 *
 * Pure: no I/O, no process access; the caller supplies the source text. Matching
 * per line is what lets a hit carry a line number. This is the kernel's plain-code
 * reference verifier; a host with its own (SMT's `findMigrationHits`) satisfies the
 * same contract and either can be used.
 */
export function verify(check: HardenedCheck, source: HostSource): CheckHit[] {
  const hits: CheckHit[] = [];
  const lines = source.text.split(/\r?\n/);

  lines.forEach((text, index) => {
    if (!check.pattern.test(text)) return;
    if (check.exempt?.test(text)) return;
    hits.push({ line: index + 1, text: text.trim() });
  });

  return hits;
}
