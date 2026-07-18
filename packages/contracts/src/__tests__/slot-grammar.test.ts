/**
 * Slot-id grammar (ADR-066/067, single-sourced here per ADR-069): the one
 * definition of what a declared slot-id segment may look like, consumed by
 * design-time validation (@seans-mfe/dsl) and the runtime matcher
 * (@seans-mfe-tool/runtime). Refs #265.
 */
import {
  SLOT_ID_SEGMENT,
  SLOT_PARAM_VALUE_SOURCE,
  isSlotParamSegment,
} from '../slot-grammar';

describe('SLOT_ID_SEGMENT', () => {
  it('accepts assigned-name literals (must contain a letter)', () => {
    for (const segment of ['main', 'info', 'game-area', 'nav_bar', 'a1', '1a', 'x-1_y']) {
      expect(SLOT_ID_SEGMENT.test(segment)).toBe(true);
    }
  });

  it('accepts {param} placeholder segments', () => {
    for (const segment of ['{gameId}', '{sku}', '{a_1}']) {
      expect(SLOT_ID_SEGMENT.test(segment)).toBe(true);
    }
  });

  it('rejects ordinals, empty, path-shaped, and malformed param segments', () => {
    for (const segment of ['1', '42', '', 'a/b', 'a.b', '{1bad}', '{}', '{x', 'x}', '{x-y}']) {
      expect(SLOT_ID_SEGMENT.test(segment)).toBe(false);
    }
  });
});

describe('isSlotParamSegment', () => {
  it('detects placeholder segments and nothing else', () => {
    expect(isSlotParamSegment('{gameId}')).toBe(true);
    expect(isSlotParamSegment('gameId')).toBe(false);
    expect(isSlotParamSegment('{1bad}')).toBe(false);
  });
});

describe('SLOT_PARAM_VALUE_SOURCE', () => {
  it('matches one runtime segment value — never a dot or slash', () => {
    const value = new RegExp(`^${SLOT_PARAM_VALUE_SOURCE}$`);
    expect(value.test('alphabet')).toBe(true);
    expect(value.test('SKU-42_x')).toBe(true);
    expect(value.test('a.b')).toBe(false);
    expect(value.test('a/b')).toBe(false);
    expect(value.test('')).toBe(false);
  });
});
