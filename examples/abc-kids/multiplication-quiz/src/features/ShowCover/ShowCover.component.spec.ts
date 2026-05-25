/**
 * ShowCover Feature Tests (Angular)
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ShowCoverComponent } from './ShowCover.component';

describe('ShowCoverComponent', () => {
  let fixture: ComponentFixture<ShowCoverComponent>;
  let component: ShowCoverComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowCoverComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowCoverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders without crashing', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('ShowCover');
  });

  // TODO: Add more tests based on capability inputs/outputs
});
