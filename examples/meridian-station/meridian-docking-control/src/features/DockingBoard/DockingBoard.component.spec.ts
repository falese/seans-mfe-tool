/**
 * DockingBoard Feature Tests (Angular)
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { DockingBoardComponent } from './DockingBoard.component';

const BOARD_DATA = {
  listBerths: [
    { berthId: 'b1', berthClass: 'medium_freight', occupiedFlag: 1, maxMassKg: 250000, currentDockingId: 4021 },
    { berthId: 'b4', berthClass: 'medium_freight', occupiedFlag: 0, maxMassKg: 250000, currentDockingId: null },
  ],
  listDockings: [
    { dockingId: 4021, berthId: 'b1', vesselRegistryNo: 'VR-88213', etaUtc: '2026-07-17T14:30:00Z', statusCode: 'DOCKED' },
  ],
  charges: [
    { dockingRef: 'DCK-004021', chargeType: 'DOCKING_FEE', amountCents: 480000, status: 'PENDING' },
    { dockingRef: 'DCK-004021', chargeType: 'HAZMAT_SURCHARGE', amountCents: 150000, status: 'DISPUTED' },
    { dockingRef: 'DCK-004019', chargeType: 'DOCKING_FEE', amountCents: 505000, status: 'PAID' },
  ],
};

describe('DockingBoardComponent', () => {
  let fixture: ComponentFixture<DockingBoardComponent>;

  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue(BOARD_DATA);
    await TestBed.configureTestingModule({
      imports: [DockingBoardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DockingBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders one row per berth with the docked vessel from the Harbormaster', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('b1');
    expect(compiled.textContent).toContain('VR-88213');
    expect(compiled.textContent).toContain('DOCKED');
  });

  it('joins outstanding StellarLedger charges by docking ref (4021 ↔ DCK-004021)', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    // 480000 PENDING + 150000 DISPUTED = ₢ 6,300.00 outstanding on b1
    expect(compiled.textContent).toContain('₢ 6,300.00');
    expect(compiled.textContent).toContain('DISPUTED');
  });

  it('shows a free berth with no vessel and no outstanding tariff', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('FREE');
  });

  it('surfaces a readable error when the BFF is unreachable', async () => {
    queryMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const failing = TestBed.createComponent(DockingBoardComponent);
    failing.detectChanges();
    await failing.whenStable();
    failing.detectChanges();
    expect((failing.nativeElement as HTMLElement).textContent).toContain('Docking board unavailable');
  });
});
