import { BUSY_MS, CODE_TYPES, COMPOSITION_PENDING, performStep, replayAnswer } from '../capture';

const page = (click: () => Promise<void>) =>
  ({ click, goto: jest.fn(), fill: jest.fn(), press: jest.fn(), waitForTimeout: jest.fn() }) as unknown as Parameters<typeof performStep>[0];
const gone = () => Promise.reject(new Error("page.click: Timeout 15000ms exceeded. waiting for locator('a[href=\"/@ada\"]')"));

describe('performStep', () => {
  it('reaches an explored link that is gone by its href instead, and reports the step it performed', async () => {
    const p = page(gone);
    await expect(performStep(p, { click: 'a[href="/@ada"]' }, 'http://localhost:4100', { optional: true, fallbackHref: '/@ada' })).resolves.toEqual({ goto: '/@ada' });
    expect((p as unknown as { goto: jest.Mock }).goto).toHaveBeenCalledWith('http://localhost:4100/@ada', expect.anything());
  });
  it('fails a journey step that cannot be performed — a written journey is a contract', async () => {
    await expect(performStep(page(gone), { click: 'a[href="/@ada"]' }, 'http://localhost:4100', { optional: false })).rejects.toThrow(/Timeout/);
  });
  it('skips an explored link that is no longer on the page, instead of aborting the capture', async () => {
    // Exploration queues links from the page it is on; an earlier click may have navigated away (#442).
    await expect(performStep(page(gone), { click: 'a[href="/@ada"]' }, 'http://localhost:4100', { optional: true })).resolves.toBeNull();
    await expect(performStep(page(() => Promise.resolve()), { click: 'a[href="/"]' }, 'http://localhost:4100', { optional: true })).resolves.toEqual({ click: 'a[href="/"]' });
  });
});

describe('replayAnswer', () => {
  it('lets an unrecorded GraphQL request to another origin reach its BFF, which answers from the capture (ADR-127 §4)', () => {
    expect(replayAnswer('POST', 'http://localhost:5205/graphql', 'http://localhost:5199', {})).toEqual({ kind: 'continue' });
    // The CORS preflight the browser sends first.
    expect(replayAnswer('OPTIONS', 'http://localhost:5205/graphql', 'http://localhost:5199', {})).toEqual({ kind: 'continue' });
    // The app's own GraphQL endpoint is still answered from the recording, or missed.
    expect(replayAnswer('POST', 'http://localhost:5199/graphql', 'http://localhost:5199', {})).toMatchObject({ kind: 'fulfill', status: 404, miss: true });
  });

  it('lets a composed shell reach its control plane: that is not the app\'s data', () => {
    expect(replayAnswer('POST', 'http://localhost:5199/__control-plane/graphql', 'http://localhost:5199', {})).toEqual({ kind: 'continue' });
  });
  const recorded = { 'GET /api/tags': { status: 200, mimeType: 'application/json', body: { tags: ['x'] } } };
  it('answers a recorded call from the recording, and an unrecorded one with a 404 it reports', () => {
    expect(replayAnswer('GET', 'http://localhost:4100/api/tags', 'http://localhost:4100', recorded)).toEqual({ kind: 'fulfill', status: 200, mimeType: 'application/json', body: '{"tags":["x"]}', miss: false });
    expect(replayAnswer('GET', 'http://localhost:4100/api/user', 'http://localhost:4100', recorded)).toMatchObject({ kind: 'fulfill', status: 404, miss: true });
  });
  it('lets the dev server’s own traffic through: it is never recorded, so a 404 would be a new error (#442)', () => {
    expect(replayAnswer('GET', 'http://localhost:4100/sockjs-node/info?t=1', 'http://localhost:4100', recorded)).toEqual({ kind: 'continue' });
  });
});

describe('a composed app settles when its composition has (ADR-111, ADR-113)', () => {
  it('waits for a shell still awaiting its first experience, and for slots the LayoutManager has not filled', () => {
    // A composed step is not over when the network goes quiet: the shell is still waiting on the
    // control plane, or a slot on its remote. A monolith has neither marker, so nothing changes there.
    expect(COMPOSITION_PENDING).toBe('[data-composition="pending"], [data-slot-state="pending"]');
  });

  it('is not settled while code is loading: a remote\'s chunks make the step\'s API calls once they arrive', () => {
    expect([...CODE_TYPES]).toEqual(['Script', 'Stylesheet']);
  });

  it('is not settled while the page is too busy to answer: a large first render precedes its own requests', () => {
    expect(BUSY_MS).toBe(100);
  });
});
