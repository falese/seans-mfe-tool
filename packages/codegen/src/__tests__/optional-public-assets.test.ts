/**
 * Optional public assets are variant-owned, not universally expected (#341).
 *
 * `base-mfe-angular` ships no `public/demo.html.ejs` and no
 * `public/favicon.ico.ejs`, and the generator warned about both on every run —
 * two lines per Angular MFE, eight across the fleet, printed by
 * `check:mfe-drift` in between the STALE entries a reader is meant to be
 * studying. A diagnostic that fires on a variant legitimately lacking the file
 * is not a diagnostic; it is noise that trains people to skim the gate.
 *
 * This follows the precedent already in `unified-generator.ts`: slot emission
 * probes the variant's own `templateDir` for a `slots.*.ejs` rather than
 * hardcoding framework names, precisely so a new framework adds support by
 * shipping a template (ADR-036). Optional assets work the same way.
 *
 * The distinction that matters, and what these tests pin: **optional** assets
 * go quiet, **required** ones still warn. Silencing everything would trade one
 * bug for a worse one.
 */

import path from 'path';
import { generateAllFiles, OPTIONAL_PUBLIC_ASSETS } from '../unified-generator';

const BASE = path.join(__dirname, 'output-optional-assets');

const manifest = (framework: string) => ({
  name: `AssetsMFE${framework}`,
  version: '1.0.0',
  description: 'Fixture for optional public assets',
  endpoint: 'http://localhost:3001',
  framework,
  capabilities: [{ Dashboard: { type: 'domain', description: 'A dashboard' } }],
  dependencies: { 'design-system': {}, mfes: {} },
});

describe('optional public assets (#341)', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  afterAll(async () => {
    const fs = await import('fs-extra');
    await fs.remove(BASE);
  });

  /** Every warning line the generator emitted, joined for substring matching. */
  const warnings = (): string => warn.mock.calls.map((c) => c.join(' ')).join('\n');

  describe('the Angular variant, which ships neither template', () => {
    let paths: string[];

    beforeAll(async () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      const { files } = await generateAllFiles(
        manifest('angular') as never,
        path.join(BASE, 'angular'),
        { force: true } as never,
      );
      paths = files.map((f) => f.path);
      spy.mockRestore();
    });

    it('emits no demo.html and no favicon.ico', () => {
      expect(paths.some((p) => p.endsWith('public/demo.html'))).toBe(false);
      expect(paths.some((p) => p.endsWith('public/favicon.ico'))).toBe(false);
    });
  });

  it('says nothing about the assets the Angular variant does not ship', async () => {
    await generateAllFiles(manifest('angular') as never, path.join(BASE, 'quiet'), {
      force: true,
    } as never);

    // The exact two lines the drill complained about.
    expect(warnings()).not.toContain('public/demo.html');
    expect(warnings()).not.toContain('public/favicon.ico');
  });

  it('still emits both for React, which does ship them', async () => {
    const { files } = await generateAllFiles(
      manifest('react') as never,
      path.join(BASE, 'react'),
      { force: true } as never,
    );
    const paths = files.map((f) => f.path);

    expect(paths.some((p) => p.endsWith(path.join('public', 'demo.html')))).toBe(true);
    expect(paths.some((p) => p.endsWith(path.join('public', 'favicon.ico')))).toBe(true);
    expect(warnings()).not.toContain('public/demo.html');
  });

  describe('the optional set is narrow, so required templates still warn', () => {
    it('does not include index.html — an MFE with no HTML entry cannot be served', () => {
      // The failure mode this guards is silencing the diagnostic wholesale,
      // which would trade a noisy gate for a silent one. Asserted against the
      // exported set rather than by trying to conjure a variant that ships no
      // index.html: every variant ships one, so no such fixture exists to
      // generate, and a test that cannot fail is not a test.
      expect(OPTIONAL_PUBLIC_ASSETS).not.toContain('index.html');
    });

    it('is exactly the two assets base-mfe-angular legitimately lacks', () => {
      expect([...OPTIONAL_PUBLIC_ASSETS].sort()).toEqual(['demo.html', 'favicon.ico']);
    });
  });
});
