/**
 * Behavioural pin: the demo registry's slot matcher vs. the real one (ADR-073 §5).
 *
 * Each fleet's `control-plane/registry/slot-target.js` carries a copy of the
 * matcher rather than calling `createSlotAddressRegistry`, because those
 * registries are standalone dockerized services and `@seans-mfe/contracts` is
 * not published yet (docs/MERGE-PLAN.md Phase 1). A copy that drifts is worse
 * than no copy: the registry would accept placements the runtime rejects, or
 * reject ones it accepts.
 *
 * This is the same idiom ADR-069 used to pin the grammar across packages, and
 * it should be deleted the moment the registry can import the package.
 */
import * as path from 'path';
import { createSlotAddressRegistry } from '../slot-contract';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const registryModulePath = path.join(
  __dirname,
  '../../../../examples/meridian-station/control-plane/registry/slot-target.js'
);

type RegistryProblem = { fatal: boolean; reason: string; message: string } | null;
type ValidateSlotTarget = (
  address: string,
  providedSlotsByMfe: Map<string, string[]>
) => RegistryProblem;

/** The registry copy is ESM-only JS; jest transpiles it on require. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateSlotTarget } = require(registryModulePath) as {
  validateSlotTarget: ValidateSlotTarget;
};

const DECLARATIONS = ['main', 'status', 'berth.{id}', 'section.{key}.footer'];

const shared = createSlotAddressRegistry([
  { mfeId: 'console', declarations: DECLARATIONS.map((id) => ({ id })) },
]);
const copyVocabulary = new Map([['console', DECLARATIONS]]);

/** Addresses spanning every branch both implementations must agree on. */
const ADDRESSES = [
  // host-owned, unqualified
  'root',
  'main',
  // declared literals
  'console/main',
  'console/status',
  // keyed patterns
  'console/berth.b1',
  'console/berth.B-9_x',
  'console/section.abc.footer',
  // keyed, wrong shape
  'console/berth.b1.extra',
  'console/berth.',
  'console/section.footer',
  // undeclared on a known provider
  'console/nope',
  'console/mian',
  // regex metacharacters must be literal, not wildcards
  'console/mXin',
  // unknown provider
  'other/main',
  // malformed
  '/main',
  'console/',
];

describe('demo registry slot matcher pin (ADR-073 §5)', () => {
  it.each(ADDRESSES)('agrees with @seans-mfe/contracts on "%s"', (address) => {
    const expected = shared.validateTarget(address);
    const actual = validateSlotTarget(address, copyVocabulary);

    if (expected.status === 'ok') {
      expect(actual).toBeNull();
      return;
    }

    expect(actual).not.toBeNull();
    expect(actual?.reason).toBe(expected.reason);
    // Only `unknown-provider` is advisory on both sides; everything else blocks.
    expect(actual?.fatal).toBe(expected.reason !== 'unknown-provider');
  });

  it('accepts declarations given as {id} objects or bare strings', () => {
    // registerMfe normalizes providesSlots either way before calling in.
    expect(validateSlotTarget('console/main', new Map([['console', ['main']]]))).toBeNull();
  });
});
