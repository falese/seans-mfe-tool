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

describe('FIND_CONTROLS, forms', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label for="q">Search passengers</label><input id="q" type="search" value="Ros" />
      <input type="email" placeholder="Email" />
      <input type="number" aria-label="Quantity" value="2" />
      <textarea aria-label="Notes"></textarea>
      <label>Clearance <select><option value="ALL">All</option><option value="FLAGGED" selected>Flagged</option></select></label>
      <input type="hidden" name="secret" value="x" />
      <input type="checkbox" aria-label="Only mine" checked />`;
  });

  it('finds text fields by label, placeholder or aria-label, with their input type', () => {
    const fields = find().controls.filter((c) => (c as { input?: string }).input !== undefined);
    expect(fields).toEqual([
      { role: 'searchbox', name: 'Search passengers', input: 'search' },
      { role: 'textbox', name: 'Email', input: 'email' },
      { role: 'spinbutton', name: 'Quantity', input: 'number' },
      { role: 'textbox', name: 'Notes', input: 'textarea' },
    ]);
  });

  it('finds a dropdown with its option values', () => {
    expect(find().controls.find((c) => c.role === 'combobox')).toEqual({ role: 'combobox', name: 'Clearance', options: ['ALL', 'FLAGGED'] });
  });

  it('reads every form value, so a fill is a new state', () => {
    expect((find() as unknown as { values: string[] }).values).toEqual([
      'searchbox:Search passengers=Ros',
      'textbox:Email=',
      'spinbutton:Quantity=2',
      'textbox:Notes=',
      'combobox:Clearance=FLAGGED',
      'checkbox:Only mine=true',
    ]);
  });
});
