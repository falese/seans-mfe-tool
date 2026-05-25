/**
 * GetGameInfo Feature Tests (Angular)
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { GetGameInfoComponent } from './GetGameInfo.component';

describe('GetGameInfoComponent', () => {
  let fixture: ComponentFixture<GetGameInfoComponent>;
  let component: GetGameInfoComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GetGameInfoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GetGameInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders without crashing', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('GetGameInfo');
  });

  // TODO: Add more tests based on capability inputs/outputs
});
