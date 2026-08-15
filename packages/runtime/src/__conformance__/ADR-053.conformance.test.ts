/**
 * ADR-053 conformance — `BaseMFE.doQuery` is the single implementation.
 *
 * The decision has two halves, and only checking one would let the other
 * regress: `RemoteMFE` must not override `doQuery`, **and** the generated
 * `mfe.ts` must not reintroduce an override plus its `fetchBff()` helper. Both
 * existed only to work around a throw that no longer exists; either coming back
 * silently restores the behaviour the ADR removed.
 *
 * Nothing checked this before — the only test that mentioned ADR-053 was about
 * control-plane messages and unrelated. That is the gap ADR-000 exists to
 * close, and this file is what closes it for this decision.
 *
 * Proven by breaking it: reinstating a `doQuery` override on RemoteMFE, or in
 * the template, turns this red. A pack that has never failed has not been shown
 * to check anything.
 */
import * as fs from 'fs';
import * as path from 'path';
import { BaseMFE } from '../base-mfe';
import { RemoteMFE } from '../remote-mfe';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('ADR-053: RemoteMFE inherits doQuery rather than overriding it', () => {
  it('does not define doQuery on RemoteMFE.prototype', () => {
    // Own property, not inherited: the whole point is that the lookup falls
    // through to BaseMFE.
    expect(Object.prototype.hasOwnProperty.call(RemoteMFE.prototype, 'doQuery')).toBe(false);
  });

  it('resolves doQuery to the BaseMFE implementation through the chain', () => {
    const proto = RemoteMFE.prototype as unknown as Record<string, unknown>;
    const base = BaseMFE.prototype as unknown as Record<string, unknown>;
    expect(typeof proto.doQuery).toBe('function');
    expect(proto.doQuery).toBe(base.doQuery);
  });

  it('keeps the generated mfe.ts template free of a doQuery override', () => {
    // The second half of the decision. The runtime could stay clean while
    // codegen quietly re-emits the override into every MFE.
    const template = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/codegen/templates/base-mfe/mfe.ts.ejs'),
      'utf8'
    );
    expect(template).not.toMatch(/\bprotected\s+async\s+doQuery\s*\(/);
    // The helper existed solely to serve that override.
    expect(template).not.toMatch(/\bfunction\s+fetchBff\s*\(/);
  });
});
