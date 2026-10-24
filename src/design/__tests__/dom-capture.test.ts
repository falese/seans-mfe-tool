import { captureDesignTree, launchBrowser, MAX_FULL_PAGE_HEIGHT } from '../dom-capture';

describe('launchBrowser', () => {
  it('reports why every launch attempt failed, not just the last (#409)', async () => {
    const chromium = {
      launch: async (opts?: { channel?: string; executablePath?: string }) => {
        if (opts?.channel) throw new Error("Chromium distribution 'chrome' is not found\nmore detail");
        if (opts?.executablePath) throw new Error('spawn /opt/chromium ENOENT');
        throw new Error("Executable doesn't exist at /root/.cache/ms-playwright/chromium-1200/chrome\n╔═══╗");
      },
    };
    const err = await launchBrowser(chromium, { CHROMIUM_PATH: '/opt/chromium' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain("bundled: Executable doesn't exist at /root/.cache/ms-playwright/chromium-1200/chrome");
    expect(message).toContain('CHROMIUM_PATH=/opt/chromium: spawn /opt/chromium ENOENT');
    expect(message).toContain("channel chrome: Chromium distribution 'chrome' is not found");
    expect(message).not.toContain('more detail');
  });

  it('returns the first browser that launches', async () => {
    const browser = { newPage: jest.fn(), close: jest.fn() };
    const launch = jest.fn().mockRejectedValueOnce(new Error('no bundled')).mockResolvedValueOnce(browser);
    await expect(launchBrowser({ launch }, {})).resolves.toBe(browser);
    expect(launch).toHaveBeenLastCalledWith({ headless: true, channel: 'chrome' });
  });
});

describe('captureDesignTree', () => {
  function fakeChromium(pageHeight: number) {
    const viewports: Array<{ width: number; height: number }> = [];
    const evaluated: string[] = [];
    const screenshots: unknown[] = [];
    const page = {
      setViewportSize: async (size: { width: number; height: number }) => {
        viewports.push(size);
      },
      goto: async () => undefined,
      waitForTimeout: async () => undefined,
      title: async () => 'T',
      evaluate: async (fn: unknown) => {
        const src = String(fn);
        evaluated.push(src);
        if (src.includes('scrollHeight')) return pageHeight;
        if (src.includes('innerWidth')) {
          const last = viewports[viewports.length - 1];
          return { x: 0, y: 0, width: last.width, height: last.height };
        }
        return JSON.stringify({ records: [{ kind: 'element', parentIndex: -1, tag: 'body', rect: { x: 0, y: 0, width: 1, height: 1 } }], title: 'T' });
      },
      screenshot: async (opts: unknown) => {
        screenshots.push(opts);
        return Buffer.from('png');
      },
    };
    const chromium = { launch: async () => ({ newPage: async () => page, close: async () => undefined }) };
    return { chromium, viewports, evaluated, screenshots };
  }

  const options = { url: 'http://x', viewport: { width: 800, height: 600 }, waitMs: 0, fullPage: true };

  it('brings the serialized page back as one JSON string (#409)', async () => {
    const fake = fakeChromium(1000);
    const result = await captureDesignTree(options, fake.chromium);
    expect(fake.evaluated.some((src) => src.startsWith('JSON.stringify(') && src.includes('records'))).toBe(true);
    expect(result.records).toHaveLength(1);
  });

  it('caps a full-page capture at the height Chromium can screenshot, and reports the page height', async () => {
    const fake = fakeChromium(450_000);
    const result = await captureDesignTree(options, fake.chromium);
    expect(fake.viewports[fake.viewports.length - 1]).toEqual({ width: 800, height: MAX_FULL_PAGE_HEIGHT });
    expect(fake.screenshots).toEqual([{ type: 'png' }]);
    expect(result.viewport).toEqual({ x: 0, y: 0, width: 800, height: MAX_FULL_PAGE_HEIGHT });
    expect(result.pageHeight).toBe(450_000);
  });

  it('keeps the viewport as the capture area without --full-page', async () => {
    const fake = fakeChromium(5000);
    const result = await captureDesignTree({ ...options, fullPage: false }, fake.chromium);
    expect(result.viewport).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });
});
