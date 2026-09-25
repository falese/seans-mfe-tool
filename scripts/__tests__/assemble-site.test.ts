/**
 * assemble-site.js keeps a landing-page card only when the thing it links to
 * was actually built (ADR-104). Each optional build — the slide deck, the HTML
 * API reference — is non-fatal in the Pages workflow, so a failed one must
 * drop its card rather than publish a link check-site would reject as a 404.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '..', 'assemble-site.js');

function assemble(prebuilt: string[]): string {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'assemble-site-'));
  for (const rel of prebuilt) {
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.writeFileSync(path.join(out, rel), '<!doctype html><title>built</title>');
  }
  execFileSync('node', [SCRIPT, out], { stdio: 'pipe' });
  return out;
}

const landing = (out: string): string => fs.readFileSync(path.join(out, 'index.html'), 'utf8');

describe('assemble-site — optional cards', () => {
  it('drops the API reference card when the API reference was not built', () => {
    const html = landing(assemble([]));
    expect(html).not.toContain('href="api/index.html"');
    expect(html).not.toContain('api-card:');
  });

  it('keeps the API reference card, markers stripped, when api/index.html exists', () => {
    const html = landing(assemble(['api/index.html']));
    expect(html).toContain('href="api/index.html"');
    expect(html).not.toContain('api-card:');
  });

  it('decides the deck card independently of the API card', () => {
    const html = landing(assemble(['api/index.html']));
    expect(html).not.toContain('href="slides/platform-architecture.html"');

    const both = landing(assemble(['api/index.html', 'slides/platform-architecture.html']));
    expect(both).toContain('href="slides/platform-architecture.html"');
    expect(both).toContain('href="api/index.html"');
  });

  it('writes the same landing page to 404.html', () => {
    const out = assemble(['api/index.html']);
    expect(fs.readFileSync(path.join(out, '404.html'), 'utf8')).toBe(landing(out));
  });
});
