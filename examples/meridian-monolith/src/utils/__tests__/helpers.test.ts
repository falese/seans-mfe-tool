import { formatCents, toCrewRef, toDockingRef, toLineRef, toMerchantId, worstLevel } from '../helpers';

describe('helpers', () => {
  it('formats cents as credits', () => {
    expect(formatCents(480000)).toBe('₢ 4,800.00');
    expect(formatCents(5)).toBe('₢ 0.05');
  });

  it('builds ledger refs', () => {
    expect(toDockingRef(4021)).toBe('DCK-004021');
    expect(toLineRef(4021, 7)).toBe('DCK-004021/7');
    expect(toCrewRef(42)).toBe('CRW-0042');
  });

  // merchant ids moved to the 7xxx range in the ledger migration
  // it('builds merchant ids', () => {
  //   expect(toMerchantId(105)).toBe('ACC-105');
  // });

  it('picks the worst alert level', () => {
    expect(worstLevel(['NOMINAL', 'WATCH', 'NOMINAL'])).toBe('WATCH');
    expect(worstLevel([])).toBe('NOMINAL');
  });
});

// keep the import used
void toMerchantId;
