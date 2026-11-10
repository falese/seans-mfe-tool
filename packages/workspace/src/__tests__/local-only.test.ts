/**
 * The workspace's servers listen on 127.0.0.1, which keeps other machines out
 * and does nothing about the browser already on this one. Any page the
 * developer has open can send a request to a loopback port; these servers edit
 * a repository, record approvals in the developer's name and spend model
 * credit, so they refuse a request that did not come from their own page.
 */
import type { IncomingMessage } from 'http';
import { crossSiteRefusal } from '../local-only';

const req = (headers: Record<string, string>): IncomingMessage => ({ headers }) as unknown as IncomingMessage;

describe('crossSiteRefusal', () => {
  it('lets through a request with no Origin: a server-side caller, or a same-origin GET', () => {
    expect(crossSiteRefusal(req({ host: '127.0.0.1:4611' }))).toBeUndefined();
  });

  it('lets through the page’s own origin, under either loopback name', () => {
    expect(crossSiteRefusal(req({ host: '127.0.0.1:4611', origin: 'http://127.0.0.1:4611' }))).toBeUndefined();
    expect(crossSiteRefusal(req({ host: 'localhost:4611', origin: 'http://localhost:4611' }))).toBeUndefined();
  });

  it('lets through an origin the caller names', () => {
    const allowed = ['http://127.0.0.1:4611'];
    expect(crossSiteRefusal(req({ host: '127.0.0.1:5611', origin: 'http://127.0.0.1:4611' }), allowed)).toBeUndefined();
  });

  it.each([
    ['another site', 'https://evil.example'],
    ['another port on this machine', 'http://127.0.0.1:9999'],
    ['an opaque origin: a sandboxed frame or a file', 'null'],
  ])('refuses %s', (_label, origin) => {
    expect(crossSiteRefusal(req({ host: '127.0.0.1:4611', origin }))).toMatch(/origin/);
  });

  it('refuses a Host that is not this machine: a rebound DNS name resolves here but is not ours', () => {
    expect(crossSiteRefusal(req({ host: 'evil.example:4611' }))).toMatch(/host/);
    expect(crossSiteRefusal(req({}))).toMatch(/host/);
  });

  it('refuses what the browser itself labels cross-site, whatever else it sends', () => {
    expect(crossSiteRefusal(req({ host: '127.0.0.1:4611', 'sec-fetch-site': 'cross-site' }))).toMatch(/cross-site/);
  });
});
