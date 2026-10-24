import { backendLayout, backendOf, splitBackendUrl } from '../backends';

describe('backendLayout', () => {
  it('reads /api/<backend>/<resource> as a gateway in front of several backends', () => {
    expect(backendLayout(['/api/harbormaster/berths', '/api/ledger/charges?x=1', '/api/stationos/crew'])).toEqual({ gateway: true });
  });
  it('reads /api/<resource> as one API — a resource at the top means there is no backend segment (#442)', () => {
    expect(backendLayout(['/api/tags', '/api/articles/notes/comments', '/api/user'])).toEqual({ gateway: false });
  });
  it('judges by concrete URLs only, and keeps the gateway reading when there are none', () => {
    expect(backendLayout(['/api/harbormaster{path}', '/api/{?}'])).toEqual({ gateway: true });
    expect(backendLayout([])).toEqual({ gateway: true });
  });
});

describe('splitBackendUrl under one API', () => {
  it('names the backend for the API, and keeps every segment after it as the path', () => {
    expect(splitBackendUrl('/api/articles/notes?x=1', { gateway: false })).toEqual({ origin: '', backend: 'api', prefix: '/api', path: '/articles/notes', query: 'x=1' });
    expect(backendOf('https://conduit.productionready.io/api/tags', { gateway: false })).toBe('conduit');
    expect(backendOf('/api/harbormaster/berths')).toBe('harbormaster');
  });
});
