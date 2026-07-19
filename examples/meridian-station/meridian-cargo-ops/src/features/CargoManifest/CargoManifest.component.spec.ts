/**
 * CargoManifest Feature Tests (Angular)
 */
import { TestBed } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { CargoManifestComponent } from './CargoManifest.component';

const DATA = {
  listManifestLines: [
    { lineId: 1, dockingId: 4021, sku: 'CRYO-CELL-42', description: 'Cryogenic fuel cells', qty: 12, declaredMassKg: 1840.5, hazardClass: 'CRYO' },
    { lineId: 2, dockingId: 4027, sku: 'BIO-CULT-3', description: 'Live bio cultures', qty: 6, declaredMassKg: 240, hazardClass: 'BIO' },
  ],
  valuations: [
    { manifestLineRef: 'DCK-004021/1', declaredValueCents: 9600000, insuranceClass: 'SPECIALIZED' },
    // DCK-004027/2 deliberately absent — finance hasn't processed it.
  ],
  listDockings: [
    { dockingId: 4021, berthId: 'b1', vesselRegistryNo: 'VR-88213', statusCode: 'DOCKED' },
    { dockingId: 4027, berthId: 'b5', vesselRegistryNo: 'VR-77045', statusCode: 'DOCKED' },
  ],
};

describe('CargoManifestComponent', () => {
  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue(DATA);
    await TestBed.configureTestingModule({ imports: [CargoManifestComponent] }).compileComponents();
  });

  it('joins harbormaster lines with ledger valuations by composite ref', async () => {
    const fixture = TestBed.createComponent(CargoManifestComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('DCK-004021/1');
    expect(text).toContain('₢ 96,000.00');
    expect(text).toContain('VR-88213');
  });

  it('shows the valuation gap instead of hiding the unprocessed line', async () => {
    const fixture = TestBed.createComponent(CargoManifestComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('valuation pending — finance');
  });
});
