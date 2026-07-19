/**
 * HazardSummary Feature Tests (Angular)
 */
import { TestBed } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { HazardSummaryComponent } from './HazardSummary.component';

describe('HazardSummaryComponent', () => {
  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue({
      listManifestLines: [
        { lineId: 1, dockingId: 4021, sku: 'CRYO-CELL-42', qty: 12, declaredMassKg: 1840.5, hazardClass: 'CRYO' },
        { lineId: 2, dockingId: 4021, sku: 'HAB-PANEL-7', qty: 40, declaredMassKg: 5200, hazardClass: 'NONE' },
        { lineId: 1, dockingId: 4019, sku: 'SCRAP-ALLOY', qty: 120, declaredMassKg: 15000, hazardClass: 'NONE' },
      ],
      listDockings: [
        { dockingId: 4021, statusCode: 'DOCKED' },
        { dockingId: 4019, statusCode: 'DEPARTED' },
      ],
    });
    await TestBed.configureTestingModule({ imports: [HazardSummaryComponent] }).compileComponents();
  });

  it('groups docked hazardous lines and drops NONE and departed cargo', async () => {
    const fixture = TestBed.createComponent(HazardSummaryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.groups).toEqual([
      { hazard: 'CRYO', skus: ['CRYO-CELL-42'], massKg: 1840.5 },
    ]);
  });
});
