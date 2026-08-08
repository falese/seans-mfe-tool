/**
 * ADR-072 conformance — `DeclaredSlot` is the app-code API, and the ids it
 * takes are the manifest's.
 *
 * ADR-072 made two promises. The first — that providers stop hand-rolling
 * `useCallback` ref callbacks around `slotContract.register()` and use the
 * generated component — was kept: both example providers were converted, the
 * bespoke `data-berth` attribute is gone, and the accidental fourth copy of the
 * template in `generate-games.mjs` was removed.
 *
 * The second is the one worth a gate:
 *
 *   "A slot rename is caught by `tsc` in every consuming MFE, so the manifest
 *    diff and the code that must change surface in the same review."
 *
 * The typing machinery for that works. `slots.tsx` generates
 * `DeclaredSlotId = 'main' | 'status' | ` + '`berth.${string}`' + `, the component's
 * `id` prop is narrowed to it, and `tsc` really does reject a stale id:
 *
 *     StationConsole.tsx(184,9): error TS2322:
 *       Type '"status"' is not assignable to type 'DeclaredSlotId'.
 *
 * **Nothing ever runs that `tsc`.** Measured by renaming `status` to
 * `statusRail` in the meridian-console manifest, regenerating, and running the
 * whole gate set against app code that still said `id="status"`: `typecheck`,
 * `test`, `check:mfe-drift:check` and `check:mfe-consistency` were all green.
 * The root `tsconfig.json` excludes `examples`, and the only thing that caught
 * it — `mfe:validate --typecheck` — is run by no gate and needs each MFE's
 * `node_modules` installed to work.
 *
 * So the promise held in the compiler and not in the review. This pack checks
 * the same property statically: every slot id that app code hands to
 * `DeclaredSlot` must be one its own manifest declares, matched through
 * `createSlotContract` so design time cannot disagree with run time (ADR-069).
 *
 * Scope: this is **narrower than `tsc`**. It reads literal and
 * simple-template-literal `id` props, not ids computed through a variable, and
 * it does not typecheck anything else about these MFEs. It closes the rename
 * case, which is the one the ADR names and the one that bites.
 *
 * Each check proven able to fail: rename a declared slot in a manifest (2),
 * hand-roll a register() callback in app code (1), reintroduce a bespoke DOM
 * attribute (3), drop DeclaredSlotId from a generated slots.tsx (4), narrow the
 * published component's id to a union (5).
 */
import * as fs from 'fs';
import * as path from 'path';
import { load as parseYaml } from 'js-yaml';
import { createSlotContract } from '@falese/smt-contracts';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXAMPLES = path.join(REPO_ROOT, 'examples');

interface Provider {
  /** Repo-relative MFE directory. */
  dir: string;
  declared: string[];
  /** Developer-authored source files (never the generated slots.tsx / platform tree). */
  appCode: { file: string; text: string }[];
}

/** Every example MFE whose manifest declares slots, with its authored sources. */
function providers(): Provider[] {
  const found: Provider[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const manifestPath = path.join(full, 'mfe-manifest.yaml');
      if (fs.existsSync(manifestPath)) {
        const manifest = parseYaml(fs.readFileSync(manifestPath, 'utf8')) as {
          providesSlots?: { id: string }[];
        };
        if (manifest.providesSlots?.length) {
          found.push({
            dir: path.relative(REPO_ROOT, full),
            declared: manifest.providesSlots.map((slot) => slot.id),
            appCode: authoredSources(path.join(full, 'src')),
          });
        }
        continue; // an MFE does not nest another MFE
      }
      walk(full);
    }
  };

  walk(EXAMPLES);
  return found;
}

/**
 * Developer-authored sources under an MFE's `src`.
 *
 * `platform/` is the generator-owned tree and `slots.tsx` is the generated data
 * layer; both mirror the manifest by construction, so including them would make
 * every check here agree with itself. This is the same exclusion the
 * `slots-implemented` rule needed and did not have — it counted `bootstrap.ts`,
 * which embeds the manifest as JSON, and went vacuous the moment an MFE was
 * built.
 */
function authoredSources(root: string): { file: string; text: string }[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return ['platform', 'node_modules', 'dist'].includes(entry.name) ? [] : authoredSources(full);
    }
    if (!/\.(tsx?|jsx?|html)$/.test(entry.name)) return [];
    if (/^slots\.(tsx?|jsx?)$/.test(entry.name)) return [];
    return [{ file: path.relative(REPO_ROOT, full), text: fs.readFileSync(full, 'utf8') }];
  });
}

/**
 * Slot ids handed to the sanctioned API, as a matcher-ready string.
 *
 * `` id={`berth.${berthId}`} `` becomes `berth.x` — one arbitrary value in the
 * param position — which is exactly what `` `berth.${string}` `` promises and
 * what the runtime matcher must accept.
 */
function declaredSlotIdsUsed(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(/\bid=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
    const literal = m[1];
    const template = m[2];
    if (literal !== undefined) ids.push(literal);
    else if (template !== undefined && !template.includes('${'))
      ids.push(template);
    else if (template !== undefined) ids.push(template.replace(/\$\{[^}]*\}/g, 'x'));
  }
  return ids;
}

const PROVIDERS = providers();

describe('ADR-072: DeclaredSlot is the sanctioned slot registration API', () => {
  it('finds the provider MFEs (a sweep over nothing proves nothing)', () => {
    expect(PROVIDERS.length).toBeGreaterThan(0);
    for (const provider of PROVIDERS) expect(provider.appCode.length).toBeGreaterThan(0);
  });

  it.each(PROVIDERS.map((p) => [p.dir, p] as const))(
    '%s registers through the sanctioned API, not a hand-rolled callback',
    (_dir, provider) => {
      // The adoption hole ADR-072 closed: `register()` stays public as the
      // framework-adaptor escape hatch, but app code reaching for it means
      // every provider re-implements the same four lines slightly differently —
      // which is how the DOM contract diverged three ways in the first place.
      const handRolled = provider.appCode.filter((source) =>
        /slotContract\.register\s*\(|contract\.register\s*\(/.test(source.text)
      );
      expect(handRolled.map((s) => s.file)).toEqual([]);

      const usesSugar = provider.appCode.some((source) =>
        /<DeclaredSlot|smtDeclaredSlot/.test(source.text)
      );
      expect(usesSugar).toBe(true);
    }
  );

  it.each(PROVIDERS.map((p) => [p.dir, p] as const))(
    '%s only uses slot ids its own manifest declares',
    (_dir, provider) => {
      // The rename promise, enforced where `tsc` is not run. Matched through
      // createSlotContract rather than string equality so a keyed id is judged
      // by the same matcher the runtime uses (ADR-069) — `berth.x` satisfies
      // `berth.{id}`, and `berth.a.b` does not.
      const contract = createSlotContract(provider.declared.map((id) => ({ id })));

      const stale: string[] = [];
      for (const source of provider.appCode) {
        if (!/<DeclaredSlot|smtDeclaredSlot/.test(source.text)) continue;
        for (const id of declaredSlotIdsUsed(source.text)) {
          if (!contract.matches(id)) stale.push(`${source.file}: id "${id}"`);
        }
      }
      expect(stale).toEqual([]);
    }
  );

  it.each(PROVIDERS.map((p) => [p.dir, p] as const))(
    '%s leaves the DOM contract to the component',
    (_dir, provider) => {
      // ADR-072's uniform `data-declared-slot`. StationConsole used to
      // hand-copy that attribute onto some regions and emit `data-berth` on
      // others, and an e2e spec had come to depend on the bespoke one — so a
      // convention nobody could rely on had already grown a consumer.
      const bespoke = provider.appCode.filter((source) =>
        /data-(?!declared-slot)[a-z-]*slot|data-berth/.test(source.text)
      );
      expect(bespoke.map((s) => s.file)).toEqual([]);
    }
  );

  it.each(PROVIDERS.map((p) => [p.dir, p] as const))(
    '%s generates a manifest-typed id union',
    (_dir, provider) => {
      // The data layer is what makes the rename a compile error rather than a
      // runtime throw. A literal becomes a string-literal member; a {param}
      // segment becomes `${string}`.
      const slotsFile = path.join(REPO_ROOT, provider.dir, 'src', 'slots.tsx');
      expect(fs.existsSync(slotsFile)).toBe(true);
      const text = fs.readFileSync(slotsFile, 'utf8');

      expect(text).toMatch(/export type DeclaredSlotId =/);
      expect(text).toMatch(/id:\s*DeclaredSlotId/);

      for (const declared of provider.declared) {
        const expected = declared.includes('{')
          ? declared.replace(/\{[^}]*\}/g, '${string}')
          : `'${declared}'`;
        expect(text).toContain(expected);
      }
    }
  );

  it('keeps the published component generic — it is bound to no manifest', () => {
    // ADR-072 §4 is explicit that the published copy keeps `id: string` and a
    // structural `contract` prop. Narrowing it would be the same mistake in
    // reverse: a package that cannot know any one manifest's ids pretending it
    // does.
    const published = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'framework-react', 'src', 'runtime', 'DeclaredSlot.tsx'),
      'utf8'
    );

    // Scoped to the props interface. A whole-file `id: string` match passed a
    // break-test that narrowed the prop, because `SlotContractLike.register`
    // also takes an `id: string` — the assertion was true of the wrong
    // declaration.
    const props = published.match(/export interface DeclaredSlotProps[^]*?\n\}/)?.[0];
    expect(props).toBeDefined();
    expect(props).toMatch(/\bid:\s*string;/);
    expect(props).toMatch(/contract:\s*SlotContractLike;/);
    expect(published).toMatch(/data-declared-slot=\{id\}/);
  });

  it('carries no fourth copy of the registration template', () => {
    // ADR-072 §4 removed the copy `generate-games.mjs` had inlined as a string
    // literal. Three deliberate copies remain, all covered by the drift gate;
    // a fourth is the lock-step burden the decision exists to prevent.
    const generator = fs.readFileSync(
      path.join(EXAMPLES, 'abc-kids', 'scripts', 'generate-games.mjs'),
      'utf8'
    );
    expect(generator).not.toMatch(/export function DeclaredSlot|createSlotContract\(/);
  });
});
