/**
 * PlayGame Feature Tests (Angular)
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { PlayGameComponent } from './PlayGame.component';

describe('PlayGameComponent', () => {
  let fixture: ComponentFixture<PlayGameComponent>;
  let component: PlayGameComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayGameComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders without crashing', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('PlayGame');
  });

  // TODO: Add more tests based on capability inputs/outputs
});
