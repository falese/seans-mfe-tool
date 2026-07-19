/**
 * AlertsFeed Feature Tests (Angular)
 */
import { TestBed } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { AlertsFeedComponent } from './AlertsFeed.component';

describe('AlertsFeedComponent', () => {
  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue({
      telemetry: [
        { readingId: 1, moduleId: 3, metricKind: 'CO2_PPM', metricValue: 640, recordedAtUtc: '2026-07-18T05:40:00Z', alertLevel: 'WATCH' },
        { readingId: 2, moduleId: 2, metricKind: 'TEMP_C', metricValue: 22.1, recordedAtUtc: '2026-07-18T05:41:00Z', alertLevel: 'NOMINAL' },
        { readingId: 3, moduleId: 6, metricKind: 'CO2_PPM', metricValue: 1180, recordedAtUtc: '2026-07-18T05:42:00Z', alertLevel: 'CRITICAL' },
      ],
    });
    await TestBed.configureTestingModule({ imports: [AlertsFeedComponent] }).compileComponents();
  });

  it('keeps only WATCH/CRITICAL readings, newest first', async () => {
    const fixture = TestBed.createComponent(AlertsFeedComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const levels = fixture.componentInstance.alerts.map((a) => a.alertLevel);
    expect(levels).toEqual(['CRITICAL', 'WATCH']);
  });
});
