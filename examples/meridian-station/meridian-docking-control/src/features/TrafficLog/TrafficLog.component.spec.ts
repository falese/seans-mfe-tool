/**
 * TrafficLog Feature Tests (Angular)
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { TrafficLogComponent } from './TrafficLog.component';

const TRAFFIC_DATA = {
  listDockings: [
    { dockingId: 4030, berthId: 'b6', vesselRegistryNo: 'VR-72410', etaUtc: '2026-07-18T09:55:00Z', statusCode: 'APPROACH' },
    { dockingId: 4021, berthId: 'b1', vesselRegistryNo: 'VR-88213', etaUtc: '2026-07-17T14:30:00Z', statusCode: 'DOCKED' },
    { dockingId: 4019, berthId: 'b2', vesselRegistryNo: 'VR-77045', etaUtc: '2026-07-14T06:00:00Z', statusCode: 'DEPARTED' },
  ],
};

describe('TrafficLogComponent', () => {
  let fixture: ComponentFixture<TrafficLogComponent>;

  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue(TRAFFIC_DATA);
    await TestBed.configureTestingModule({
      imports: [TrafficLogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TrafficLogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders one entry per docking movement', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('VR-72410');
    expect(text).toContain('VR-88213');
    expect(text).toContain('VR-77045');
  });

  it('orders the log newest first by ETA', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.indexOf('VR-72410')).toBeLessThan(text.indexOf('VR-77045'));
  });
});
