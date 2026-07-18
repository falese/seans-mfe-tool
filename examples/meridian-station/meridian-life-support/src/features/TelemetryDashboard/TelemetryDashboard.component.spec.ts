/**
 * TelemetryDashboard Feature Tests (Angular)
 */
import { TestBed } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { TelemetryDashboardComponent } from './TelemetryDashboard.component';

const DATA = {
  modules: [
    { moduleId: 3, moduleName: 'Life Support Ring B', deckZone: 'RING-B', moduleType: 'LIFE_SUPPORT' },
    { moduleId: 6, moduleName: 'Habitat Block 3', deckZone: 'HAB-3', moduleType: 'HABITAT' },
  ],
  telemetry: [
    { readingId: 1, moduleId: 3, metricKind: 'O2_PARTIAL_PRESSURE', metricValue: 21.2, recordedAtUtc: '2026-07-18T05:40:00Z', alertLevel: 'NOMINAL' },
    { readingId: 2, moduleId: 6, metricKind: 'CO2_PPM', metricValue: 1180, recordedAtUtc: '2026-07-18T05:42:00Z', alertLevel: 'CRITICAL' },
  ],
};

describe('TelemetryDashboardComponent', () => {
  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue(DATA);
    await TestBed.configureTestingModule({ imports: [TelemetryDashboardComponent] }).compileComponents();
  });

  it('renders one panel per module with its readings', async () => {
    const fixture = TestBed.createComponent(TelemetryDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Life Support Ring B');
    expect(text).toContain('O2_PARTIAL_PRESSURE');
    expect(text).toContain('1,180 ppm');
  });
});
