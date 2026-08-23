/**
 * ADR library drift rules (ADR-075).
 *
 * Every fixture here is a reduction of a defect the 2026-07-25 library review
 * actually found, cited by its real location. A rule that cannot fail on the
 * real defect is a rule that does not work, so the positive cases are the point
 * and the negative cases guard against a rule that fires on everything.
 */

import { parseAdrDocument } from '../adr-schema';
import type { AdrDocument, AdrParseFailure } from '../adr-schema';
import { validateAdrLibrary } from '../adr-validation';
import type { AdrValidationRule } from '../adr-validation';

/** Build a valid ADR document with the given frontmatter overrides. */
function adr(
  id: number,
  title: string,
  overrides: Record<string, unknown> = {},
  body = ''
): AdrDocument {
  const fm: Record<string, unknown> = {
    id,
    title,
    status: 'Accepted',
    date: '2026-07-25',
    deciders: ['sean'],
    area: 'Testing',
    enforcement: 'code',
    tags: [],
    ...overrides,
  };
  const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  const text = `---\n${yamlLines.join('\n')}\n---\n${body}`;
  const result = parseAdrDocument(`docs/architecture-decisions/ADR-${id}.md`, text);
  if (result.status !== 'ok') throw new Error(`fixture invalid: ${result.failure.message}`);
  return result.document;
}

function rulesHit(issues: { rule: AdrValidationRule }[]): AdrValidationRule[] {
  return [...new Set(issues.map((i) => i.rule))];
}

describe('validateAdrLibrary', () => {
  describe('frontmatter-valid', () => {
    it('reports a prose-header ADR (ADR-057..073 shape, 16 files at review time)', () => {
      const failure: AdrParseFailure = {
        path: 'docs/architecture-decisions/ADR-057-virtualized-daemon-socket.md',
        reason: 'no-frontmatter',
        message: 'no YAML frontmatter block — ADR-075 §1 requires one',
      };
      const result = validateAdrLibrary({ documents: [], parseFailures: [failure] });

      expect(result.ok).toBe(false);
      expect(rulesHit(result.issues)).toContain('frontmatter-valid');
      expect(result.issues[0].file).toContain('ADR-057');
    });

    it('rejects a free-text status qualifier at parse time', () => {
      // "Accepted (impl deferred, #252)" — ADR-064's real header. The closed
      // enum is what makes the status column aggregable (ADR-075 §2).
      const parsed = parseAdrDocument(
        'ADR-064.md',
        `---\nid: 64\ntitle: T\nstatus: Accepted (impl deferred, #252)\ndate: "2026-07-01"\narea: A\nenforcement: code\n---\nbody`
      );
      expect(parsed.status).toBe('failed');
      if (parsed.status === 'failed') expect(parsed.failure.reason).toBe('schema');
    });

    it('accepts a well-formed ADR', () => {
      const result = validateAdrLibrary({
        documents: [adr(75, 'Fine', { 'implemented-by': ['CLAUDE.md'] })],
        parseFailures: [],
      });
      expect(result.ok).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('reference-resolves', () => {
    it('reports the file line, not the body line', () => {
      // The frontmatter block sits above the body; a body-relative index
      // printed as `file:line` points at unrelated text.
      const doc = adr(10, 'Ten', {}, 'intro\n\nSee ADR-999 here.');
      const result = validateAdrLibrary({ documents: [doc], parseFailures: [] });
      const issue = result.issues.find((i) => i.rule === 'reference-resolves');
      expect(issue?.line).toBe(doc.bodyLine + 2);
      expect(issue?.line).toBeGreaterThan(3);
    });

    it('reports a citation of an ADR that does not exist', () => {
      const result = validateAdrLibrary({
        documents: [adr(10, 'Ten', {}, 'See ADR-999 for the rationale.')],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('reference-resolves');
    });

    it('does not report a citation of an ADR that does exist', () => {
      const result = validateAdrLibrary({
        documents: [adr(10, 'Ten', {}, 'See ADR-011 for the rationale.'), adr(11, 'Eleven')],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).not.toContain('reference-resolves');
    });
  });

  describe('reference-gloss-matches', () => {
    // The twelve real defects: PR #194 renumbered the files and left every
    // reference inside the bodies pointing at the old meaning.
    it.each([
      ['ADR-005:61', '- ADR-013: Language-Agnostic DSL Contract', 13, 'Generated MFE Test Templates'],
      ['ADR-025:368', '- ADR-013: BaseMFE abstract base (context, state machine)', 13, 'Generated MFE Test Templates'],
      ['ADR-006:54', '- ADR-001: GraphQL Data Standardization', 1, 'Lifecycle Re-Entrancy Guard in BaseMFE'],
      ['ADR-003:52', '- ADR-031: Standardized Extensible Lifecycle Hooks (supersedes custom phase design)', 31, 'Conditional Execution with Jexl Expression Engine'],
      ['ADR-007:60', '- ADR-019: JWT-Based Authorization (current approach while this is deferred)', 19, 'MCP child-process isolation'],
      ['ADR-014:94', '- ADR-008: TypeScript Strict Mode (Agent Orchestrator)', 8, 'Data Type Metadata'],
    ])('catches the stale reference at %s', (_where, line, targetId, targetTitle) => {
      const result = validateAdrLibrary({
        documents: [adr(90, 'Citing', {}, line), adr(targetId, targetTitle)],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('reference-gloss-matches');
    });

    it('is not fooled by an incidental tag match on a title-length gloss', () => {
      // ADR-003:52 cites "ADR-031: Standardized Extensible Lifecycle Hooks".
      // ADR-031 really is about lifecycle — `lifecycle` is one of its tags — but
      // it is a Jexl conditional-execution decision, not that one. A gloss this
      // long is claiming the title, so only the title counts.
      const result = validateAdrLibrary({
        documents: [
          adr(90, 'Citing', {}, '- ADR-031: Standardized Extensible Lifecycle Hooks (precursor)'),
          adr(31, 'Conditional Execution with Jexl Expression Engine', {
            tags: ['runtime', 'lifecycle', 'conditional', 'dsl', 'jexl'],
          }),
        ],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('reference-gloss-matches');
    });

    it('accepts a gloss that shares vocabulary with the target title', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(90, 'Citing', {}, '- ADR-041: BaseMFE abstract base class'),
          adr(41, 'BaseMFE Abstract Base Class & Platform Capability Contract'),
        ],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).not.toContain('reference-gloss-matches');
    });

    it('accepts a paraphrase that matches the target summary or tags, not its title', () => {
      // ADR-074's real References section: "ADR-073 — design-time validation".
      // Comparing against title alone made this a false positive.
      const result = validateAdrLibrary({
        documents: [
          adr(90, 'Citing', {}, '- ADR-073: design-time validation; §4 reuses its provider lookup'),
          adr(73, 'Slot contract logic moves to contracts', {
            tags: ['design-time', 'validation', 'slots'],
          }),
        ],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).not.toContain('reference-gloss-matches');
    });

    it('honours an inline suppression comment', () => {
      const body = '- ADR-013: Language-Agnostic DSL Contract <!-- adr-lint-ignore: reference-gloss-matches -->';
      const result = validateAdrLibrary({
        documents: [adr(90, 'Citing', {}, body), adr(13, 'Generated MFE Test Templates')],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).not.toContain('reference-gloss-matches');
    });
  });

  describe('supersession-bidirectional', () => {
    it('reports a one-way supersession (ADR-060 → ADR-056 at review time)', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(60, 'Contextualized VM composition', { supersedes: [56] }),
          adr(56, 'MFE presentation boundary', { 'superseded-by': [] }),
        ],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('supersession-bidirectional');
    });

    it('reports the reverse one-way case too', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(68, 'Provider-scoped slot addresses', { supersedes: [] }),
          adr(58, 'Slot-provider MFEs', { 'superseded-by': [68] }),
        ],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('supersession-bidirectional');
    });

    it('accepts a supersession linked from both sides', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(68, 'Provider-scoped slot addresses', {
            supersedes: [58],
            'implemented-by': ['CLAUDE.md'],
          }),
          adr(58, 'Slot-provider MFEs', {
            'superseded-by': [68],
            'implemented-by': ['CLAUDE.md'],
          }),
        ],
        parseFailures: [],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('implemented-by-exists', () => {
    it('reports a declared path that is not on disk (the ADR-041 defect class)', () => {
      const result = validateAdrLibrary({
        documents: [adr(41, 'BaseMFE', { 'implemented-by': ['src/runtime/base-mfe.ts'] })],
        parseFailures: [],
        existingPaths: new Set(['packages/runtime/src/base-mfe.ts']),
      });
      expect(rulesHit(result.issues)).toContain('implemented-by-exists');
    });

    it('accepts a declared path that exists', () => {
      const result = validateAdrLibrary({
        documents: [adr(41, 'BaseMFE', { 'implemented-by': ['packages/runtime/src/base-mfe.ts'] })],
        parseFailures: [],
        existingPaths: new Set(['packages/runtime/src/base-mfe.ts']),
      });
      expect(result.ok).toBe(true);
    });

    it('is skipped when the caller supplies no path set', () => {
      // Same discipline as slots-implemented (ADR-073 §3): a check with no
      // inputs must skip, not flag everything.
      const result = validateAdrLibrary({
        documents: [adr(41, 'BaseMFE', { 'implemented-by': ['nowhere.ts'] })],
        parseFailures: [],
      });
      expect(result.checked).not.toContain('implemented-by-exists');
      expect(result.ok).toBe(true);
    });
  });

  describe('code-cites-ratified-adr', () => {
    it('reports code citing a Proposed ADR (ADR-029 / ADR-030 at review time)', () => {
      const result = validateAdrLibrary({
        documents: [adr(29, 'Timeout Protection with AbortSignal', { status: 'Proposed' })],
        parseFailures: [],
        sources: [
          {
            path: 'packages/runtime/src/timeout-wrapper.ts',
            text: ' * Following ADR-029: Timeout Protection with AbortSignal\n',
          },
        ],
      });
      expect(rulesHit(result.issues)).toContain('code-cites-ratified-adr');
      expect(result.issues[0].file).toBe('packages/runtime/src/timeout-wrapper.ts');
    });

    it('accepts code citing an Implemented ADR', () => {
      const result = validateAdrLibrary({
        documents: [adr(27, 'Mesh v0.100.x plugins', { status: 'Implemented' })],
        parseFailures: [],
        sources: [{ path: 'x.ts', text: '// ADR-027 applies here' }],
      });
      expect(rulesHit(result.issues)).not.toContain('code-cites-ratified-adr');
    });

    it('accepts code citing a Deferred ADR — the deferral is the decision', () => {
      // packages/dsl/src/schema.ts:151 — `authorization: z.string().optional()
      // // Deferred - ADR-007`. Pointing at the decision to defer is right.
      const result = validateAdrLibrary({
        documents: [adr(7, 'Authorization Expression Grammar', { status: 'Deferred' })],
        parseFailures: [],
        sources: [{ path: 'packages/dsl/src/schema.ts', text: '  authorization, // Deferred - ADR-007' }],
      });
      expect(rulesHit(result.issues)).not.toContain('code-cites-ratified-adr');
    });

    it('honours a code-comment suppression', () => {
      const result = validateAdrLibrary({
        documents: [adr(28, 'Parallel Handler Execution', { status: 'Proposed' })],
        parseFailures: [],
        sources: [
          { path: 'x.ts', text: '// the proposed ADR-028 stages slot in here — adr-lint-ignore: code-cites-ratified-adr' },
        ],
      });
      expect(rulesHit(result.issues)).not.toContain('code-cites-ratified-adr');
    });

    it('reports code citing an ADR that does not exist at all', () => {
      const result = validateAdrLibrary({
        documents: [adr(12, 'GraphQL Mesh BFF Layer', { status: 'Implemented' })],
        parseFailures: [],
        sources: [
          {
            path: 'examples/abc-kids/color-mixer/server.ts',
            text: ' * Following ADR-046: GraphQL Mesh with DSL-embedded configuration\n',
          },
        ],
      });
      expect(rulesHit(result.issues)).toContain('code-cites-ratified-adr');
    });

    it('is skipped when the caller supplies no sources', () => {
      const result = validateAdrLibrary({
        documents: [adr(29, 'Timeout', { status: 'Proposed' })],
        parseFailures: [],
      });
      expect(result.checked).not.toContain('code-cites-ratified-adr');
    });
  });

  describe('register-complete', () => {
    it('reports an ADR file missing from the index', () => {
      const result = validateAdrLibrary({
        documents: [adr(74, 'Registration is a build artifact')],
        parseFailures: [],
        indexIds: [],
      });
      expect(rulesHit(result.issues)).toContain('register-complete');
    });

    it('reports an index row with no ADR file', () => {
      const result = validateAdrLibrary({
        documents: [],
        parseFailures: [],
        indexIds: [74],
      });
      expect(rulesHit(result.issues)).toContain('register-complete');
    });

    it('accepts a matching set', () => {
      const result = validateAdrLibrary({
        documents: [adr(74, 'Registration is a build artifact', { 'implemented-by': ['CLAUDE.md'] })],
        parseFailures: [],
        indexIds: [74],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('accepted-work-is-tracked (ADR-075 §6)', () => {
    it('reports an Accepted ADR that neither names code nor schedules work', () => {
      // The ADR-045..049 shape: ratified, then nothing ever pointed at it again.
      const result = validateAdrLibrary({
        documents: [adr(47, 'CODEOWNERS and review routing')],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('accepted-work-is-tracked');
    });

    it('accepts an Accepted ADR whose code exists', () => {
      const result = validateAdrLibrary({
        documents: [adr(41, 'BaseMFE', { 'implemented-by': ['packages/runtime/src/base-mfe.ts'] })],
        parseFailures: [],
        existingPaths: new Set(['packages/runtime/src/base-mfe.ts']),
      });
      expect(result.ok).toBe(true);
    });

    it('accepts an Accepted ADR whose work is scheduled by an issue', () => {
      const result = validateAdrLibrary({
        documents: [adr(70, 'Supergraph', { impl: { stage: 'phased', refs: ['#282'] } })],
        parseFailures: [],
      });
      expect(result.ok).toBe(true);
    });

    it('reports parked work with no tracking issue', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(70, 'Federated supergraph', {
            impl: { stage: 'deferred', refs: [] },
            'implemented-by': ['packages/runtime/src/base-mfe.ts'],
          }),
        ],
        existingPaths: new Set(['packages/runtime/src/base-mfe.ts']),
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('accepted-work-is-tracked');
    });

    it('accepts parked work that names its issue', () => {
      const result = validateAdrLibrary({
        documents: [adr(64, 'Runtime as a package', { impl: { stage: 'deferred', refs: ['#252'] } })],
        parseFailures: [],
      });
      expect(result.ok).toBe(true);
    });

    it('does not require refs for phased work already carried by code', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(25, 'Handler interface', {
            impl: { stage: 'phased', refs: [] },
            'implemented-by': ['packages/runtime/src/base-mfe.ts'],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['packages/runtime/src/base-mfe.ts']),
      });
      expect(rulesHit(result.issues)).not.toContain('accepted-work-is-tracked');
    });
  });

  describe('implemented-claims-evidence (ADR-075 §6)', () => {
    it('reports an Implemented ADR that names no code', () => {
      const result = validateAdrLibrary({
        documents: [adr(53, 'RemoteMFE.doQuery', { status: 'Implemented' })],
        parseFailures: [],
      });
      expect(rulesHit(result.issues)).toContain('implemented-claims-evidence');
    });

    it('accepts an Implemented ADR that names code', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(53, 'RemoteMFE.doQuery', {
            status: 'Implemented',
            'implemented-by': ['packages/runtime/src/remote-mfe.ts'],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['packages/runtime/src/remote-mfe.ts']),
      });
      expect(result.ok).toBe(true);
    });

    it('does not demand verified-by — some decisions have no dedicated gate', () => {
      // ADR-004 "Handler Array Support" is verified by the general suite;
      // forcing it to name a gate would mean inventing one.
      const result = validateAdrLibrary({
        documents: [
          adr(4, 'Handler Array Support', {
            status: 'Implemented',
            'implemented-by': ['packages/dsl/src/schema.ts'],
            'verified-by': [],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['packages/dsl/src/schema.ts']),
      });
      expect(result.ok).toBe(true);
    });

    it('reports a verified-by entry that resolves to nothing', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(50, 'Dependency governance', {
            status: 'Implemented',
            'implemented-by': ['packages/codegen/src/unified-generator.ts'],
            'verified-by': ['check:does-not-exist'],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['packages/codegen/src/unified-generator.ts']),
        scriptNames: new Set(['check:mfe-consistency', 'check:adr']),
      });
      expect(rulesHit(result.issues)).toContain('implemented-claims-evidence');
    });

    it('accepts a verified-by naming a real npm script', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(50, 'Dependency governance', {
            status: 'Implemented',
            'implemented-by': ['packages/codegen/src/unified-generator.ts'],
            'verified-by': ['check:mfe-consistency'],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['packages/codegen/src/unified-generator.ts']),
        scriptNames: new Set(['check:mfe-consistency']),
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('finished-work-says-so (ADR-075 §6)', () => {
    it('reports an Accepted ADR whose work is done and cited by code', () => {
      // The ADR-029 failure inverted: code shipped, status never moved.
      const result = validateAdrLibrary({
        documents: [
          adr(29, 'Timeout Protection', {
            status: 'Accepted',
            'implemented-by': ['packages/runtime/src/timeout-wrapper.ts'],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['packages/runtime/src/timeout-wrapper.ts']),
        sources: [{ path: 'packages/runtime/src/timeout-wrapper.ts', text: '// ADR-029' }],
      });
      expect(rulesHit(result.issues)).toContain('finished-work-says-so');
    });

    it('stays quiet while work is still phased', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(65, 'Generated API reference', {
            status: 'Accepted',
            impl: { stage: 'phased', refs: ['#264'] },
            'implemented-by': ['scripts/generate-dsl-schema.ts'],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['scripts/generate-dsl-schema.ts']),
        sources: [{ path: 'x.ts', text: '// ADR-065' }],
      });
      expect(rulesHit(result.issues)).not.toContain('finished-work-says-so');
    });

    it('stays quiet when no code cites it — a ratified decision may just be policy', () => {
      const result = validateAdrLibrary({
        documents: [
          adr(37, 'TDD always', {
            status: 'Accepted',
            'implemented-by': ['CLAUDE.md'],
          }),
        ],
        parseFailures: [],
        existingPaths: new Set(['CLAUDE.md']),
        sources: [{ path: 'x.ts', text: 'unrelated' }],
      });
      expect(rulesHit(result.issues)).not.toContain('finished-work-says-so');
    });
  });

  it('reports which rules ran, so a skipped rule is visible', () => {
    const result = validateAdrLibrary({ documents: [adr(1, 'One')], parseFailures: [] });
    expect(result.checked).toEqual(
      expect.arrayContaining([
        'frontmatter-valid',
        'reference-resolves',
        'reference-gloss-matches',
        'supersession-bidirectional',
      ])
    );
  });
});
