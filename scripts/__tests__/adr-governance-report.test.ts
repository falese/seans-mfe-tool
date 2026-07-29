/**
 * The governance report's generated-code-contract section (ADR-082).
 *
 * ADR-082 shipped the mechanism and named its own weakness in the same
 * breath: *"A hand-maintained registry only works if declaring an entry is
 * part of making a breaking change. Nothing enforces that."* This section is
 * the reminder that survives a session that skims — so what it must get right
 * is not firing, but **not firing when it shouldn't**. A reminder that appears
 * on every PR is a reminder nobody reads, and then the registry goes
 * unmaintained exactly as if the section did not exist.
 *
 * Hence the shape of these tests: one case for the trigger, and several for
 * the silences.
 *
 * These are also the script's first tests. It has carried real logic since
 * ADR-075 — a diff scan, blockquote stripping, table-cell escaping — with none.
 */

import {
  GENERATED_CONTRACT_PATHS,
  MIGRATION_REGISTRY,
  generatedContractSection,
} from '../adr-governance-report';

/** The section as one blob, for asserting on its prose. */
const render = (files: string[]): string => generatedContractSection(files).join('\n');

describe('generatedContractSection', () => {
  describe('fires when a change can reach code the generator does not own', () => {
    it('on a template change — the case the ADR-017 drill lived through', () => {
      const out = render(['packages/codegen/templates/base-mfe/index.tsx.ejs']);

      expect(out).toContain('packages/codegen/templates/base-mfe/index.tsx.ejs');
      expect(out).toContain('ADR-082');
      // The fix has to be nameable without opening the ADR.
      expect(out).toContain(MIGRATION_REGISTRY);
    });

    it('on a runtime change — the package generated MFEs import from', () => {
      expect(render(['packages/runtime/src/index.ts'])).toContain('packages/runtime/src/index.ts');
    });

    it('on a change to the generator logic that decides file ownership', () => {
      // Found by the first change that went through these directives: flipping
      // `.gitignore` from overwrite:false to true made regeneration start
      // OVERWRITING a file in every MFE, and this section stayed silent
      // because the list covered what generated code contains and imports but
      // not what decides its ownership. That is the more dangerous edit of the
      // two — a template change alters content the developer can review, while
      // an ownership change alters whether their edits survive at all.
      expect(render(['packages/codegen/src/unified-generator.ts'])).toContain(
        'packages/codegen/src/unified-generator.ts',
      );
    });

    it('on a contracts change, which reaches MFEs through the runtime barrel', () => {
      // `packages/runtime/src/errors/index.ts` is a pure re-export shim, so a
      // rename in contracts changes what generated code imports without any
      // runtime file appearing in the diff.
      expect(render(['packages/contracts/src/errors/validation-error.ts'])).toContain(
        'packages/contracts/src/errors/validation-error.ts',
      );
    });

    it('names one file and counts the rest, rather than listing twenty', () => {
      const out = render([
        'packages/codegen/templates/base-mfe/index.tsx.ejs',
        'packages/codegen/templates/base-mfe/mfe.ts.ejs',
        'packages/runtime/src/base-mfe.ts',
      ]);

      expect(out).toContain('packages/codegen/templates/base-mfe/index.tsx.ejs');
      expect(out).toContain('+2 more');
      expect(out).not.toContain('mfe.ts.ejs');
    });

    it('says "+1 more" in the singular', () => {
      expect(
        render(['packages/runtime/src/a.ts', 'packages/runtime/src/b.ts']),
      ).toContain('+1 more');
    });
  });

  describe('stays quiet', () => {
    it('when the PR touches nothing that reaches generated code', () => {
      expect(
        generatedContractSection(['src/commands/mfe/validate.ts', 'docs/spec.md', 'README.md']),
      ).toEqual([]);
    });

    it('on an empty diff', () => {
      expect(generatedContractSection([])).toEqual([]);
    });

    it('when the PR already declares a migration — it did the right thing', () => {
      expect(
        generatedContractSection([
          'packages/codegen/templates/base-mfe/index.tsx.ejs',
          MIGRATION_REGISTRY,
        ]),
      ).toEqual([]);
    });

    it('on tests under a triggering path — a test cannot break an MFE author', () => {
      expect(
        generatedContractSection([
          'packages/runtime/src/__tests__/base-mfe.test.ts',
          'packages/contracts/src/slot-contract.test.ts',
        ]),
      ).toEqual([]);
    });

    it('on packages that only the CLI consumes', () => {
      expect(
        generatedContractSection([
          'packages/dsl/src/slot-validation.ts',
          'packages/oclif-base/src/BaseCommand.ts',
        ]),
      ).toEqual([]);
    });

    it('on the rest of packages/codegen, which does not decide what is emitted', () => {
      // Only the emitter is a trigger. `validate.ts` and `drift.ts` read the
      // ownership flag rather than setting it, and widening to all of
      // packages/codegen/src would put this comment on nearly every codegen PR.
      expect(
        generatedContractSection([
          'packages/codegen/src/validate.ts',
          'packages/codegen/src/drift.ts',
          'packages/codegen/src/slot-types.ts',
        ]),
      ).toEqual([]);
    });

    it('on a path that merely starts like a triggering one', () => {
      // `packages/runtime-tools/` is not `packages/runtime/`.
      expect(generatedContractSection(['packages/runtime-tools/src/thing.ts'])).toEqual([]);
    });
  });

  describe('the trigger paths', () => {
    it('anchor at the start, so a nested copy of the path does not match', () => {
      for (const pattern of GENERATED_CONTRACT_PATHS) {
        expect(pattern.source.startsWith('^')).toBe(true);
      }
    });

    it('are the four that reach generated code, and no more', () => {
      // Widening this set is a decision, not a tweak: every added path is a
      // comment on more PRs, and the section is only useful while it is rare.
      expect(GENERATED_CONTRACT_PATHS).toHaveLength(4);
    });
  });

  it('produces Markdown that starts with a heading, so it slots beside the other sections', () => {
    const lines = generatedContractSection(['packages/codegen/templates/base-mfe/mfe.ts.ejs']);

    expect(lines[0]).toMatch(/^### /);
    // The report joins `out` with newlines; a trailing blank keeps the spacing
    // consistent with every other section.
    expect(lines[lines.length - 1]).toBe('');
  });
});
