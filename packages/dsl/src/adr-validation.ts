/**
 * ADR library drift rules (ADR-075).
 *
 * The decision record governs every other gate in this repo and was the last
 * artifact kept in sync by hand. It drifted exactly as the platform's own thesis
 * predicts (ADR-065, ADR-075 §Context): twelve cross-references left pointing at
 * renumbered decisions, `superseded-by` empty in all 58 frontmatter files while
 * three real supersessions lived in prose, and two ADRs marked `Proposed` while
 * shipped code cited them by number.
 *
 * These are the rules that make each of those unrepresentable. They are pure
 * functions over already-read inputs — reading files, walking `docs/`, and
 * scanning sources is `adr:validate`'s job — which is the same split ADR-073
 * used for `mfe:validate`, for the same reason: the logic is unit-tested in the
 * platform rather than re-derived by every caller.
 *
 * A rule with no inputs skips rather than flagging everything (the ADR-073 §3
 * discipline). `checked` reports what actually ran, so a silently skipped rule
 * is visible rather than mistaken for a pass.
 */

import {
  CITABLE_STATUSES,
  formatAdrId,
  normalizeAdrId,
  type AdrDocument,
  type AdrParseFailure,
} from './adr-schema';
import type { SourceFile } from './slot-validation';

export type AdrValidationRule =
  | 'frontmatter-valid'
  | 'metadata-complete'
  | 'reference-resolves'
  | 'reference-gloss-matches'
  | 'supersession-bidirectional'
  | 'implemented-by-exists'
  | 'code-cites-ratified-adr'
  | 'register-complete'
  // ADR-075 §6 — the implementation lifecycle.
  | 'enforced-claims-a-gate'
  | 'accepted-work-is-tracked'
  | 'implemented-claims-evidence'
  | 'finished-work-says-so';

export interface AdrValidationIssue {
  rule: AdrValidationRule;
  /** Repo-relative path of the file the issue is in. */
  file: string;
  /** 1-indexed line, when the finding is anchored to one. */
  line?: number;
  message: string;
  expected?: string;
  actual?: string;
}

export interface AdrValidationInput {
  /** ADRs that parsed cleanly. */
  documents: readonly AdrDocument[];
  /** ADR files that did not parse — the input to `frontmatter-valid`. */
  parseFailures: readonly AdrParseFailure[];
  /**
   * Repo-relative paths that exist on disk, for `implemented-by-exists`.
   * Omit to skip the rule.
   */
  existingPaths?: ReadonlySet<string>;
  /**
   * Source files to scan for `ADR-NNN` citations, for
   * `code-cites-ratified-adr`. Omit to skip the rule.
   */
  sources?: readonly SourceFile[];
  /** ADR ids listed in the generated index, for `register-complete`. */
  indexIds?: readonly (number | string)[];
  /**
   * npm script names from `package.json`, so a `verified-by` entry naming a gate
   * can be resolved (ADR-075 §6). Omit to skip that half of the check.
   */
  scriptNames?: ReadonlySet<string>;
  /**
   * ADR ids grandfathered out of `enforced-claims-a-gate` (ADR-000) — the
   * decisions that predate the rule and have not yet been given a checker.
   *
   * Omit to skip the rule, matching every other data-fed rule here: without the
   * list there is no way to tell a genuine gap from a known one. The set is a
   * ratchet, so the rule also reports an id that no longer needs to be on it.
   */
  conformanceBacklog?: ReadonlySet<number>;
}

export interface AdrValidationResult {
  ok: boolean;
  /** Rules that were evaluated; the rest lacked inputs and were skipped. */
  checked: AdrValidationRule[];
  issues: AdrValidationIssue[];
}

/**
 * Backlog ids present now that the baseline does not have (ADR-000 §3).
 *
 * The other half of the ratchet, and the half that was missing: ADR-000 says the
 * rule "fails on any addition", but nothing compared the list against anything,
 * so appending an id was a silent way to exempt a decision from
 * `enforced-claims-a-gate`. Comparison needs a *previous* list, which is state
 * this pure module has no way to reach — `scripts/check-backlog-ratchet.ts`
 * reads it from git and hands both sides here.
 */
export function backlogAdditions(
  current: Iterable<number>,
  baseline: Iterable<number>
): number[] {
  const known = new Set(baseline);
  return [...new Set(current)].filter((id) => !known.has(id)).sort((a, b) => a - b);
}

// ── shared matching ─────────────────────────────────────────────────────────

/** Any `ADR-NNN` mention, for existence and citation checks. */
const ADR_MENTION = /ADR-(\d{2,4})\b/g;

/**
 * A reference that *claims* a title: `ADR-013: Language-Agnostic DSL Contract`.
 *
 * Deliberately narrow. A bare `ADR-013` makes no claim and cannot be wrong about
 * one; only a citation that restates the target's identity can disagree with it.
 */
const ADR_GLOSS = /ADR-(\d{2,4})\s*[:—–-]\s*([A-Za-z][^.;|\n]{8,70})/g;

/**
 * Suppression marker, anywhere on the same line as the reference it excuses.
 *
 * Deliberately indifferent to comment syntax: markdown bodies write
 * `<!-- adr-lint-ignore: rule -->`, TypeScript writes `// adr-lint-ignore: rule`,
 * and a JSDoc block puts it mid-sentence after a ` * `. Anchoring to a comment
 * opener meant a marker that read naturally in prose silently did nothing, which
 * is the worst behaviour available for an escape hatch. The token is unusual
 * enough that its presence is the intent.
 */
export const SUPPRESSION = /adr-lint-ignore:\s*([a-z-]+)/;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'for', 'in', 'to', 'as', 'is', 'with',
  'not', 'via', 'on', 'by', 'its', 'this', 'that', 'from', 'per', 'are', 'be',
]);

/** Content words, lowercased. Short tokens carry no signal and are dropped. */
function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) ?? []
  );
}

/**
 * How many content words make a gloss a *title claim* rather than a paraphrase.
 *
 * Measured against the real corpus, and the threshold is the whole design of
 * this rule:
 *
 *   - Comparing every gloss against the title alone flags legitimate paraphrases
 *     — ADR-074's "ADR-073 — design-time validation" describes a decision whose — adr-lint-ignore: code-cites-ratified-adr
 *     title names the relocation instead.
 *   - Comparing every gloss against title + tags + summary masks real defects.
 *     "ADR-031: Standardized Extensible Lifecycle Hooks" survives — adr-lint-ignore: code-cites-ratified-adr
 *     because `lifecycle` happens to be one of that decision's tags, even
 *     though it is now a Jexl conditional-execution decision.
 *
 * A long gloss is asserting the target's identity and is held to the title. A
 * short one is describing it in passing and may match anything the ADR is about.
 */
const TITLE_CLAIM_TOKENS = 3;

/** Everything an ADR is *about*, for comparing a short paraphrase against. */
function subjectCorpus(document: AdrDocument): Set<string> {
  const { frontmatter: fm } = document;
  return contentTokens(
    [fm.title, fm.area, fm.tags.join(' '), fm.summary ?? ''].join(' ').replace(/-/g, ' ')
  );
}

/** Just the title, for comparing a title-length gloss against. */
function titleCorpus(document: AdrDocument): Set<string> {
  return contentTokens(document.frontmatter.title.replace(/-/g, ' '));
}

/** Split a body into lines once, so every rule can report a line number. */
function lines(body: string): string[] {
  return body.split(/\r?\n/);
}

// ── rules ───────────────────────────────────────────────────────────────────

export function validateAdrLibrary(input: AdrValidationInput): AdrValidationResult {
  const issues: AdrValidationIssue[] = [];
  const checked: AdrValidationRule[] = [];

  const byId = new Map<number, AdrDocument>();
  for (const document of input.documents) {
    byId.set(normalizeAdrId(document.frontmatter.id), document);
  }

  /**
   * Every id that has a *file*, including ADRs whose frontmatter did not parse.
   *
   * Without this the rules conflate two different defects: an ADR that exists
   * but has a prose header would be reported by `reference-resolves` as "not in
   * the library" and by `code-cites-ratified-adr` as "does not exist", once per
   * citation. That is noise attributable to one `frontmatter-valid` finding, and
   * it buries the citations that are genuinely wrong.
   */
  const knownIds = new Set<number>(byId.keys());
  for (const failure of input.parseFailures) {
    const id = /ADR-(\d{2,4})/.exec(failure.path);
    if (id) knownIds.add(Number.parseInt(id[1], 10));
  }

  // 1. frontmatter-valid — every ADR parses against the ADR-075 schema.
  checked.push('frontmatter-valid');
  for (const failure of input.parseFailures) {
    issues.push({
      rule: 'frontmatter-valid',
      file: failure.path,
      message: `${failure.reason}: ${failure.message}`,
    });
  }

  // 2. metadata-complete — fields ADR-075 adds that the schema leaves optional
  //    so the migration can parse the pre-ADR-075 corpus (see adr-schema.ts).
  checked.push('metadata-complete');
  for (const document of input.documents) {
    if (document.frontmatter.area) continue;
    issues.push({
      rule: 'metadata-complete',
      file: document.path,
      message: 'missing `area` — required by ADR-075 §1; it sources the index Area column',
      expected: 'area: <e.g. Runtime lifecycle>',
    });
  }

  // 3 + 4. reference-resolves / reference-gloss-matches — one pass over bodies.
  checked.push('reference-resolves', 'reference-gloss-matches');
  for (const document of input.documents) {
    const selfId = normalizeAdrId(document.frontmatter.id);

    lines(document.body).forEach((line, index) => {
      const suppressed = SUPPRESSION.exec(line)?.[1];
      const lineNumber = document.bodyLine + index;

      for (const match of line.matchAll(ADR_MENTION)) {
        const id = Number.parseInt(match[1], 10);
        if (id === selfId || knownIds.has(id)) continue;
        if (suppressed === 'reference-resolves') continue;
        issues.push({
          rule: 'reference-resolves',
          file: document.path,
          line: lineNumber,
          message: `cites ADR-${formatAdrId(id)}, which is not in the library`,
        });
      }

      if (suppressed === 'reference-gloss-matches') return;

      for (const match of line.matchAll(ADR_GLOSS)) {
        const target = byId.get(Number.parseInt(match[1], 10));
        if (!target) continue; // reference-resolves already owns this case.

        const gloss = contentTokens(match[2].replace(/-/g, ' '));
        if (gloss.size === 0) continue;

        const corpus =
          gloss.size > TITLE_CLAIM_TOKENS ? titleCorpus(target) : subjectCorpus(target);
        if ([...gloss].some((token) => corpus.has(token))) continue;

        issues.push({
          rule: 'reference-gloss-matches',
          file: document.path,
          line: lineNumber,
          message:
            `describes ADR-${formatAdrId(target.frontmatter.id)} as "${match[2].trim()}", ` +
            'which shares no vocabulary with that decision — likely a pre-reflow number ' +
            '(suppress with <!-- adr-lint-ignore: reference-gloss-matches --> if the paraphrase is right)',
          expected: target.frontmatter.title,
          actual: match[2].trim(),
        });
      }
    });
  }

  // 4. supersession-bidirectional — cross-reference-standards §3, enforced.
  checked.push('supersession-bidirectional');
  for (const document of input.documents) {
    const selfId = normalizeAdrId(document.frontmatter.id);

    for (const rawTarget of document.frontmatter.supersedes) {
      const targetId = normalizeAdrId(rawTarget);
      const target = byId.get(targetId);
      if (!target) continue; // reference-resolves owns unknown ids.
      const backlinks = target.frontmatter['superseded-by'].map(normalizeAdrId);
      if (backlinks.includes(selfId)) continue;
      issues.push({
        rule: 'supersession-bidirectional',
        file: target.path,
        message:
          `ADR-${formatAdrId(selfId)} declares it supersedes ADR-${formatAdrId(targetId)}, ` +
          `but ADR-${formatAdrId(targetId)} does not list it in superseded-by`,
        expected: `superseded-by: [${formatAdrId(selfId)}]`,
      });
    }

    for (const rawTarget of document.frontmatter['superseded-by']) {
      const targetId = normalizeAdrId(rawTarget);
      const target = byId.get(targetId);
      if (!target) continue;
      const forwardLinks = target.frontmatter.supersedes.map(normalizeAdrId);
      if (forwardLinks.includes(selfId)) continue;
      issues.push({
        rule: 'supersession-bidirectional',
        file: target.path,
        message:
          `ADR-${formatAdrId(selfId)} declares it is superseded by ADR-${formatAdrId(targetId)}, ` +
          `but ADR-${formatAdrId(targetId)} does not list it in supersedes`,
        expected: `supersedes: [${formatAdrId(selfId)}]`,
      });
    }
  }

  // 5. implemented-by-exists — a decision cannot silently lose its code.
  if (input.existingPaths) {
    checked.push('implemented-by-exists');
    for (const document of input.documents) {
      for (const declared of document.frontmatter['implemented-by']) {
        if (input.existingPaths.has(declared)) continue;
        issues.push({
          rule: 'implemented-by-exists',
          file: document.path,
          message: `implemented-by points at "${declared}", which is not in the repo`,
          actual: declared,
        });
      }
    }
  }

  // 6. code-cites-ratified-adr — source may only cite a ratified decision.
  if (input.sources) {
    checked.push('code-cites-ratified-adr');
    for (const source of input.sources) {
      const reported = new Set<number>();

      lines(source.text).forEach((line, index) => {
        if (SUPPRESSION.exec(line)?.[1] === 'code-cites-ratified-adr') return;

        for (const match of line.matchAll(ADR_MENTION)) {
          const id = Number.parseInt(match[1], 10);
          if (reported.has(id)) continue;

          const target = byId.get(id);
          if (target && CITABLE_STATUSES.includes(target.frontmatter.status)) continue;
          // Known but unparsed: frontmatter-valid already owns it, and one
          // parse failure must not re-report as N citation failures.
          if (!target && knownIds.has(id)) continue;

          reported.add(id);
          issues.push({
            rule: 'code-cites-ratified-adr',
            file: source.path,
            line: index + 1,
            message: target
              ? `cites ADR-${formatAdrId(id)}, which is ${target.frontmatter.status} — ` +
                'either the code shipped ahead of its decision or the status was never updated'
              : `cites ADR-${formatAdrId(id)}, which does not exist — likely a pre-reflow number`,
            actual: target ? target.frontmatter.status : 'no such ADR',
          });
        }
      });
    }
  }

  // 7. register-complete — the generated index and the files agree.
  if (input.indexIds) {
    checked.push('register-complete');
    const indexed = new Set(input.indexIds.map(normalizeAdrId));

    for (const id of knownIds) {
      if (indexed.has(id)) continue;
      issues.push({
        rule: 'register-complete',
        file: byId.get(id)?.path ?? `docs/architecture-decisions/ADR-${formatAdrId(id)}`,
        message: `ADR-${formatAdrId(id)} has a file but no index row — regenerate the index`,
      });
    }
    for (const id of indexed) {
      if (knownIds.has(id)) continue;
      issues.push({
        rule: 'register-complete',
        file: 'docs/spec.md',
        message: `the index lists ADR-${formatAdrId(id)}, which has no file`,
      });
    }
  }

  // ── ADR-075 §6: the implementation lifecycle ──────────────────────────────
  //
  // The rules above describe an ADR's state. These three move it: parked work
  // has to name its issue, a claim of `Implemented` has to name its code, and
  // finished work gets told to say so instead of waiting to be noticed. That
  // last one is the ADR-029 failure inverted — three files implemented and
  // cited it while the register still called it Proposed.

  // 8. accepted-work-is-tracked — a ratified decision is either carried by code
  //    or scheduled by an issue. "Neither" is how the ADR-045..049 batch became — adr-lint-ignore: code-cites-ratified-adr
  //    permanent: five decisions authored in a day, with no owner and nothing
  //    pointing at them ever again.
  checked.push('accepted-work-is-tracked');
  for (const document of input.documents) {
    const fm = document.frontmatter;
    if (fm.status !== 'Accepted') continue;

    const carried = fm['implemented-by'].length > 0;
    const scheduled = (fm.impl?.refs.length ?? 0) > 0;

    if (!carried && !scheduled) {
      issues.push({
        rule: 'accepted-work-is-tracked',
        file: document.path,
        message:
          'status is `Accepted` but nothing carries it and nothing is scheduled to — ' +
          'name the code in implemented-by, or the issues in impl.refs',
        expected: 'implemented-by: [<path>] or impl.refs: ["#NNN"]',
      });
      continue;
    }

    // Work explicitly parked still needs an issue even when something partial
    // already carries it — otherwise the remainder has no owner.
    if (fm.impl?.stage === 'deferred' && !scheduled) {
      issues.push({
        rule: 'accepted-work-is-tracked',
        file: document.path,
        message:
          'impl.stage is `deferred` but impl.refs is empty — parked work needs a tracking issue',
        expected: 'impl.refs: ["#NNN"]',
      });
    }
  }

  // 9. implemented-claims-evidence — `Implemented` must name the code that
  //    carries it. `verified-by` stays optional but must resolve when present:
  //    a declared field nothing checks is a field that rots.
  checked.push('implemented-claims-evidence');
  for (const document of input.documents) {
    const fm = document.frontmatter;

    if (fm.status === 'Implemented' && fm['implemented-by'].length === 0) {
      issues.push({
        rule: 'implemented-claims-evidence',
        file: document.path,
        message:
          'status is `Implemented` but implemented-by is empty — name the code that carries it',
        expected: 'implemented-by: [<path>]',
      });
    }

    for (const claim of fm['verified-by']) {
      const isScript = input.scriptNames?.has(claim);
      const isPath = input.existingPaths?.has(claim);
      // Skip when neither lookup is available rather than guessing.
      if (input.scriptNames === undefined && input.existingPaths === undefined) break;
      if (isScript || isPath) continue;
      issues.push({
        rule: 'implemented-claims-evidence',
        file: document.path,
        message:
          `verified-by names "${claim}", which is neither an npm script nor a file in the repo`,
        actual: claim,
      });
    }
  }

  // 9b. enforced-claims-a-gate (ADR-000) — `enforcement: code` is a claim about
  //     the codebase, and a claim nobody can falsify is decoration. The field
  //     that would carry the proof already existed and was already resolved
  //     when present; it was merely optional, which is how 49 of 74 ADRs came
  //     to assert enforcement while naming nothing.
  //
  //     `convention` is deliberately exempt: it says humans enforce this, which
  //     is honest, and demanding a gate for it would push authors to mislabel.
  if (input.conformanceBacklog) {
    checked.push('enforced-claims-a-gate');
    const backlog = input.conformanceBacklog;

    for (const document of input.documents) {
      const fm = document.frontmatter;
      const id = normalizeAdrId(fm.id);
      // The obligation attaches at `Implemented`, and only there. `enforcement:
      // code` is a claim about the codebase; before a decision is implemented
      // there is no codebase to claim about, and after supersession the
      // successor owns it. Demanding a gate anyway was asking for packs that
      // test code which does not exist: three of the lifecycle-engine decisions
      // are still Proposed with no issues filed, and one was superseded.
      // Fourteen of the thirty-seven entries left on the backlog were in that
      // position, which made the number report roughly half again as much real
      // debt as there was.
      //
      // The specific ids are deliberately not named here — `code-cites-ratified-adr`
      // forbids source citing a Proposed decision, and it caught this comment
      // doing exactly that on the first run.
      //
      // Safe because it is one-way: an ADR that flips to Implemented is not on
      // the backlog (the list only shrinks), so the rule bites immediately and
      // the checker has to ship with the code. Nothing can idle in `Proposed`
      // to dodge this.
      const claimsAutomation =
        fm.status === 'Implemented' &&
        (fm.enforcement === 'code' || fm.enforcement === 'tooling');
      // A gate has to be able to run. `docs/cli-contract.md` resolved, was
      // non-empty, and satisfied this rule for ADR-018 — while a document
      // cannot execute, cannot fail, and cannot notice drift. It was still
      // green while a bug shipped through the very invariant it describes.
      // Prose is welcome alongside a gate; it just cannot be the gate.
      const namesAGate = fm['verified-by'].some((entry) => !entry.endsWith('.md'));
      const grandfathered = backlog.has(id);

      if (claimsAutomation && !namesAGate && !grandfathered) {
        const prose = fm['verified-by'].length > 0;
        issues.push({
          rule: 'enforced-claims-a-gate',
          file: document.path,
          message: prose
            ? `enforcement is \`${fm.enforcement}\` but verified-by names only documentation — a document cannot fail, ` +
              'so it cannot be the gate (ADR-000)'
            : `enforcement is \`${fm.enforcement}\` but verified-by is empty — name the gate that proves this decision holds, ` +
              'or write a conformance pack for it (ADR-000)',
          expected: 'verified-by: [<npm script or test path>]',
          ...(prose ? { actual: fm['verified-by'].join(', ') } : {}),
        });
      }

      // The ratchet: an entry that has since gained a gate is stale, and a
      // stale entry is a hole a future regression could slip through unseen.
      if (grandfathered && namesAGate) {
        issues.push({
          rule: 'enforced-claims-a-gate',
          file: document.path,
          message:
            `ADR-${formatAdrId(id)} names a gate but is still listed in the conformance backlog — remove it, the list may only shrink (ADR-000)`,
          actual: 'listed in conformance-backlog.json',
        });
      }
    }
  }

  // 10. finished-work-says-so — the transition nobody remembers to make.
  if (input.sources) {
    checked.push('finished-work-says-so');
    const cited = new Set<number>();
    for (const source of input.sources) {
      for (const match of source.text.matchAll(ADR_MENTION)) {
        cited.add(Number.parseInt(match[1], 10));
      }
    }

    for (const document of input.documents) {
      const fm = document.frontmatter;
      const id = normalizeAdrId(fm.id);
      if (fm.status !== 'Accepted' || fm.impl) continue;
      if (fm['implemented-by'].length === 0) continue;
      if (!cited.has(id)) continue;
      if (input.existingPaths && fm['implemented-by'].some((p) => !input.existingPaths!.has(p))) {
        continue; // implemented-by-exists owns that failure.
      }
      issues.push({
        rule: 'finished-work-says-so',
        file: document.path,
        message:
          'status is `Accepted` with no work outstanding, its implemented-by paths all exist, ' +
          'and source code cites it — this looks Implemented',
        expected: 'status: Implemented',
        actual: 'Accepted',
      });
    }
  }

  return { ok: issues.length === 0, checked, issues };
}
