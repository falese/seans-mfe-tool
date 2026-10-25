import { performStep, replayAnswer } from '../capture';

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
  const recorded = { 'GET /api/tags': { status: 200, mimeType: 'application/json', body: { tags: ['x'] } } };
  it('answers a recorded call from the recording, and an unrecorded one with a 404 it reports', () => {
    expect(replayAnswer('GET', 'http://localhost:4100/api/tags', 'http://localhost:4100', recorded)).toEqual({ kind: 'fulfill', status: 200, mimeType: 'application/json', body: '{"tags":["x"]}', miss: false });
    expect(replayAnswer('GET', 'http://localhost:4100/api/user', 'http://localhost:4100', recorded)).toMatchObject({ kind: 'fulfill', status: 404, miss: true });
  });
  it('lets the dev server’s own traffic through: it is never recorded, so a 404 would be a new error (#442)', () => {
    expect(replayAnswer('GET', 'http://localhost:4100/sockjs-node/info?t=1', 'http://localhost:4100', recorded)).toEqual({ kind: 'continue' });
  });
});
