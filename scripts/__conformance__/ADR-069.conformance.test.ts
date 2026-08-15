/**
 * ADR-069 conformance — the slot-id grammar has one definition, and everything
 * that cannot import it is pinned to it.
 *
 * ADR-069 moved the grammar into `@falese/smt-contracts/slot-grammar` because it
 * had been written twice — `SLOT_ID_SEGMENT` in the DSL for design-time
 * validation, and the matcher literals in the runtime for run-time matching —
 * with no shared source, so "a change to one and not the other would silently
 * split what can be declared from what can match."
 *
 * Inside the packages that holds. The interesting part is outside them.
 *
 * ADR-069's Consequences say third-party tooling "can import the grammar from
 * contracts **instead of copying a regex**". The demo control-plane registry
 * copies it — twice, once per example fleet — and says so:
 *
 *     It is a copy, not a call: this registry is a standalone dockerized
 *     service and @falese/smt-contracts is not published yet. […] The
 *     behavioural pin lives in slot-target.test.js — the same idiom ADR-069
 *     used for the grammar.
 *
 * The copy is defensible; the registry really is a standalone container and
 * contracts really is unpublished. **`slot-target.test.js` does not exist.** It
 * has never existed in the file's history. So the sanctioned exception rested
 * on a guarantee that was described in a comment and never written, which is
 * the same failure ADR-069 exists to prevent, one level further out — and it
 * would not have run even if written, because jest's `testPathIgnorePatterns`
 * excludes `/examples/`.
 *
 * The copies happen to agree with contracts today, so nothing here went red on
 * arrival. That is worth saying plainly rather than dressing up: the defect was
 * the absent guarantee, not a present divergence, and this pack is the
 * guarantee. Check 5 is the pin the comment claimed; check 6 is what makes it
 * hold for the next copy someone adds.
 *
 * Each check proven able to fail: inline the charset in a package (1), give
 * contracts a dependency (2), drop dsl's contracts edge (3), change the literal
 * charset without the param charset (4), edit one registry's value charset (5),
 * add a third copy outside the pinned set (6).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  SLOT_ID_SEGMENT,
  SLOT_LITERAL_SEGMENT_SOURCE,
  SLOT_PARAM_SEGMENT_SOURCE,
  SLOT_PARAM_VALUE_SOURCE,
  createSlotContract,
} from '@falese/smt-contracts';
import { validateSlotTarget as abcKidsValidate } from '../../examples/abc-kids/control-plane/registry/slot-target.js';
import { validateSlotTarget as meridianValidate } from '../../examples/meridian-station/control-plane/registry/slot-target.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GRAMMAR_MODULE = path.join('packages', 'contracts', 'src', 'slot-grammar.ts');

/**
 * Copies that are allowed to exist, each paired with the entry point that pins
 * it. Adding a copy without adding it here fails check 6; adding it here
 * without a working entry point fails check 5.
 */
const PINNED_COPIES: { file: string; validate: typeof abcKidsValidate }[] = [
  {
    file: path.join('examples', 'abc-kids', 'control-plane', 'registry', 'slot-target.js'),
    validate: abcKidsValidate,
  },
  {
    file: path.join('examples', 'meridian-station', 'control-plane', 'registry', 'slot-target.js'),
    validate: meridianValidate,
  },
];

/**
 * Files carrying the grammar as literal text.
 *
 * Keyed on the two shape sources, which are distinctive enough to be
 * unmistakable. `SLOT_PARAM_VALUE_SOURCE` is deliberately not a trigger on its
 * own — `[A-Za-z0-9_-]+` is a common charset, and matching it alone would make
 * this check fire on unrelated code, which is how a guard earns being ignored.
 */
function filesDeclaringGrammar(): string[] {
  const skip = new Set(['node_modules', 'dist', '.git', 'coverage', 'build']);
  const needles = [SLOT_LITERAL_SEGMENT_SOURCE, SLOT_PARAM_SEGMENT_SOURCE.replace(/\\\\/g, '\\')];

  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (skip.has(entry.name)) return [];
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (!/\.(ts|tsx|js|jsx|mjs|cjs|ejs)$/.test(entry.name)) return [];
      const text = fs.readFileSync(full, 'utf8');
      return needles.some((needle) => text.includes(needle)) ? [path.relative(REPO_ROOT, full)] : [];
    });

  return walk(REPO_ROOT).filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`));
}

describe('ADR-069: slot grammar single-sourced in contracts', () => {
  it('defines the grammar in exactly one package module', () => {
    // The original defect: two definitions that had to agree and shared no
    // source. Everything else imports.
    const declaring = filesDeclaringGrammar();
    expect(declaring).toContain(GRAMMAR_MODULE);

    const inPackages = declaring.filter((file) => file.startsWith(`packages${path.sep}`));
    expect(inPackages).toEqual([GRAMMAR_MODULE]);
  });

  it('keeps contracts dependency-free, which is why it could hold the grammar', () => {
    // Not incidental — ADR-069 rejected a `runtime → dsl` edge specifically
    // because it "drags zod/fs-extra/js-yaml into the published runtime", and
    // chose contracts on the stated condition that the ADR-061 zero-dependency
    // invariant still holds. A dependency here retroactively invalidates the
    // choice.
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'packages', 'contracts', 'package.json'), 'utf8')
    ) as { dependencies?: object; peerDependencies?: object };

    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
    expect(Object.keys(pkg.peerDependencies ?? {})).toEqual([]);
  });

  it('declares the dsl → contracts edge the decision created', () => {
    // ADR-069: "packages/dsl gains its first workspace dependency". An import
    // that works only because the tsconfig paths and jest module map resolve it
    // is not a declared dependency, and breaks the moment dsl is built or
    // published on its own.
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'packages', 'dsl', 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };

    expect(pkg.dependencies?.['@falese/smt-contracts']).toBeDefined();
  });

  it('keeps design-time validation and run-time matching agreeing', () => {
    // The composition-level pin ADR-069 explicitly kept: the two consumers use
    // the same grammar but compose it differently — whole-id validation versus
    // matcher compilation — so one grammar is necessary but not sufficient.
    const declarable = ['games', 'game-1', 'slot_a', '{gameId}', 'a1'];
    const notDeclarable = ['123', '', 'a.b', '{1bad}', 'has space'];

    for (const id of declarable) expect(SLOT_ID_SEGMENT.test(id)).toBe(true);
    for (const id of notDeclarable) expect(SLOT_ID_SEGMENT.test(id)).toBe(false);

    // Anything declarable must be matchable, or a manifest can declare a slot
    // nothing can ever bind to.
    for (const id of declarable) {
      const contract = createSlotContract([{ id }]);
      expect(contract.matches(id.startsWith('{') ? 'someValue' : id)).toBe(true);
    }

    // A `{param}` consumes exactly one segment — the value charset excludes '.'.
    const repeated = createSlotContract([{ id: 'games.{gameId}' }]);
    expect(repeated.matches('games.flappy')).toBe(true);
    expect(repeated.matches('games.a.b')).toBe(false);
  });

  it.each(PINNED_COPIES.map((copy) => [copy.file, copy] as const))(
    '%s stays behaviourally identical to the single source',
    (_file, copy) => {
      // The pin the registry's own comment claimed and did not have. Driven
      // through both implementations rather than compared as strings: the
      // hazard is divergent *behaviour*, and a copy could match textually while
      // composing the grammar differently.
      const declarations = ['games.{gameId}', 'toolbar', 'panel-1', 'a.{b}.c'];
      const contract = createSlotContract(declarations.map((id) => ({ id })));
      const providers = new Map([['provider-mfe', declarations]]);

      const probes = [
        'games.flappy', 'games.a.b', 'games.', 'toolbar', 'Toolbar', 'panel-1',
        'panel_1', 'a.x.c', 'a.x.y.c', 'a..c', '123', 'games.123', 'games.a-b',
      ];

      for (const id of probes) {
        const acceptedByContracts = contract.matches(id);
        const acceptedByCopy = copy.validate(`provider-mfe/${id}`, providers) === null;
        expect({ id, accepted: acceptedByCopy }).toEqual({ id, accepted: acceptedByContracts });
      }
    }
  );

  it('leaves no copy of the grammar unpinned', () => {
    // What makes check 5 durable. The registry copy was legitimate and
    // documented; what was missing was anything tying it to the source. A third
    // fleet, or a linter that copies the regex "just this once", lands here
    // instead of drifting quietly until someone changes the charset.
    const copies = filesDeclaringGrammar().filter((file) => file !== GRAMMAR_MODULE);
    expect(copies.sort()).toEqual(PINNED_COPIES.map((c) => c.file).sort());
  });
});
