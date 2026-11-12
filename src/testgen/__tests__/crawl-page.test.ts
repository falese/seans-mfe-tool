/**
 * @jest-environment jsdom
 *
 * The in-page control finder, run against a DOM: what a person can operate,
 * by role and accessible name.
 */
import { FIND_CONTROLS, numberControls } from '../crawl-page';

const find = () => new Function(`return ${FIND_CONTROLS}`)() as { path: string; text: string; controls: Array<{ role: string; name: string }> };

describe('FIND_CONTROLS', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div role="tablist">
        <button role="tab">📦 Vessels</button>
        <button role="tab" aria-label="Passengers"><span>👤</span></button>
      </div>
      <button>  Open
        details </button>
      <button disabled>Disabled</button>
      <div hidden><button>Hidden</button></div>
      <a href="/cargo">Cargo</a>
      <a href="https://elsewhere.example/">Away</a>
      <input type="checkbox" aria-label="Only flagged" />
      <div role="region">not a control</div>
      <summary>More</summary>`;
  });

  it('lists every operable control by role and accessible name, in document order', () => {
    expect(find().controls).toEqual([
      { role: 'tab', name: '📦 Vessels' },
      { role: 'tab', name: 'Passengers' },
      { role: 'button', name: 'Open details' },
      { role: 'link', name: 'Cargo' },
      { role: 'checkbox', name: 'Only flagged' },
      { role: 'button', name: 'More' },
    ]);
  });

  it('reads the route and the visible text', () => {
    const s = find();
    expect(s.path).toBe('/');
    expect(s.text).toContain('Vessels');
  });
});

describe('numberControls', () => {
  it('numbers same-named controls so each has its own selector', () => {
    expect(
      numberControls([
        { role: 'button', name: 'Open' },
        { role: 'tab', name: 'Open' },
        { role: 'button', name: 'Open' },
      ])
    ).toEqual([
      { role: 'button', name: 'Open', index: 0, of: 2 },
      { role: 'tab', name: 'Open', index: 0, of: 1 },
      { role: 'button', name: 'Open', index: 1, of: 2 },
    ]);
  });
});
