/**
 * BerthTile Feature Tests (Angular)
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { BerthTileComponent } from './BerthTile.component';

const TILE_DATA = {
  getBerth: { berthId: 'b1', berthClass: 'medium_freight', occupiedFlag: 1, currentDockingId: 4021 },
  listDockings: [
    { dockingId: 4021, berthId: 'b1', vesselRegistryNo: 'VR-88213', etaUtc: '2026-07-17T14:30:00Z', statusCode: 'DOCKED' },
  ],
  charges: [
    { dockingRef: 'DCK-004021', amountCents: 480000, status: 'PENDING' },
  ],
};

async function renderTile(berthId: string): Promise<ComponentFixture<BerthTileComponent>> {
  const fixture = TestBed.createComponent(BerthTileComponent);
  fixture.componentInstance.berthId = berthId;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('BerthTileComponent', () => {
  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue(TILE_DATA);
    await TestBed.configureTestingModule({
      imports: [BerthTileComponent],
    }).compileComponents();
  });

  it('renders the berth id, vessel and status for its keyed slot', async () => {
    const fixture = await renderTile('b1');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('b1');
    expect(text).toContain('VR-88213');
    expect(text).toContain('DOCKED');
  });

  it('queries the BFF scoped to its own berth id', async () => {
    await renderTile('b3');
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ berthId: 'b3' }));
  });

  it('shows outstanding ledger charges for the current docking', async () => {
    const fixture = await renderTile('b1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('₢ 4,800.00');
  });

  it('re-queries when the runtime delivers berthId via setInput after bootstrap', async () => {
    // Mirrors the composed path: ngOnInit runs with the default (b1), then
    // the registry prop lands through ComponentRef.setInput → ngOnChanges.
    const fixture = TestBed.createComponent(BerthTileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('berthId', 'b5');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ berthId: 'b5' }));
  });
});
