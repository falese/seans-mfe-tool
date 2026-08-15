/**
 * ADR id parsing — specifically that zero is a legal id.
 *
 * ADR-000 is the root decision: every other ADR must satisfy it, so it is
 * numbered before all of them. That only works if the schema accepts `0`, and
 * it did not — `AdrIdSchema` used `z.number().int().positive()`, which excludes
 * zero, while js-yaml resolves an unquoted `id: 0000` to the number `0`. The
 * alternative was quoting ADR-000's id, inconsistent with all 85 siblings and
 * the sort of special case that gets "tidied up" later by someone who does not
 * know why it was there.
 *
 * Zero is legal; negatives are still not.
 */
import { AdrIdSchema, formatAdrId, normalizeAdrId } from '../adr-schema';

describe('AdrIdSchema', () => {
  it('accepts 0, so ADR-000 can carry an unquoted id', () => {
    expect(AdrIdSchema.safeParse(0).success).toBe(true);
  });

  it('accepts the zero-padded string form js-yaml would leave quoted', () => {
    expect(AdrIdSchema.safeParse('0000').success).toBe(true);
  });

  it('still accepts ordinary ids in both forms', () => {
    expect(AdrIdSchema.safeParse(85).success).toBe(true);
    expect(AdrIdSchema.safeParse('0085').success).toBe(true);
  });

  it('still rejects a negative id', () => {
    // The reason `.positive()` was there in the first place. Loosening it to
    // `.nonnegative()` must not open the door wider than one number.
    expect(AdrIdSchema.safeParse(-1).success).toBe(false);
  });

  it('still rejects a non-integer and a non-numeric string', () => {
    expect(AdrIdSchema.safeParse(1.5).success).toBe(false);
    expect(AdrIdSchema.safeParse('ADR-1').success).toBe(false);
  });
});

describe('id normalization at zero', () => {
  it('renders 0 as the canonical three-digit form', () => {
    expect(formatAdrId(0)).toBe('000');
    expect(formatAdrId('0000')).toBe('000');
  });

  it('normalizes both forms of zero to the number', () => {
    expect(normalizeAdrId(0)).toBe(0);
    expect(normalizeAdrId('0000')).toBe(0);
  });
});
