/**
 * ModuleStatus Feature Tests (Angular)
 */
import { TestBed } from '@angular/core/testing';

const queryMock = jest.fn();
jest.mock('../../platform/bff/bff', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { ModuleStatusComponent } from './ModuleStatus.component';

describe('ModuleStatusComponent', () => {
  beforeEach(async () => {
    queryMock.mockReset().mockResolvedValue({
      modules: [{ moduleId: 6, moduleName: 'Habitat Block 3', deckZone: 'HAB-3' }],
      telemetry: [
        { moduleId: 6, alertLevel: 'WATCH' },
        { moduleId: 6, alertLevel: 'CRITICAL' },
      ],
    });
    await TestBed.configureTestingModule({ imports: [ModuleStatusComponent] }).compileComponents();
  });

  it('rolls each module up to its worst alert level', async () => {
    const fixture = TestBed.createComponent(ModuleStatusComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.rows).toEqual([
      { name: 'Habitat Block 3', zone: 'HAB-3', level: 'CRITICAL' },
    ]);
  });
});
