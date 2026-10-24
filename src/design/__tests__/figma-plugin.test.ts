import { emitFigmaOps, fontStyleCandidates, renderPluginBundle } from '../figma-plugin';
import type { FrameDesignNode, TextDesignNode, ImageDesignNode } from '../design-tree';

const rect = (x = 0, y = 0, width = 100, height = 50) => ({ x, y, width, height });

function frame(overrides: Partial<FrameDesignNode> = {}): FrameDesignNode {
  return {
    kind: 'frame',
    name: 'div',
    rect: rect(),
    opacity: 1,
    fills: [],
    clipsContent: true,
    children: [],
    ...overrides,
  };
}

function text(overrides: Partial<TextDesignNode> = {}): TextDesignNode {
  return {
    kind: 'text',
    name: 'Hello',
    rect: rect(10, 20, 60, 16),
    opacity: 1,
    fills: [{ r: 0, g: 0, b: 0, a: 1 }],
    characters: 'Hello',
    fontFamily: 'Inter',
    fontWeight: 400,
    fontItalic: false,
    fontSize: 16,
    letterSpacing: 0,
    align: 'LEFT',
    decoration: 'NONE',
    ...overrides,
  };
}

describe('fontStyleCandidates', () => {
  it('maps weights to ordered style names with italic variants', () => {
    expect(fontStyleCandidates(700, false)[0]).toBe('Bold');
    expect(fontStyleCandidates(700, true)[0]).toBe('Bold Italic');
    expect(fontStyleCandidates(400, false)).toContain('Regular');
    expect(fontStyleCandidates(999, false)).toContain('Bold'); // clamps to 900 bucket
  });
});

describe('emitFigmaOps', () => {
  it('emits parents before children with absolute page coords', () => {
    const root = frame({
      rect: rect(0, 0, 800, 600),
      children: [
        frame({ name: 'inner', rect: rect(50, 60, 200, 100) }),
        text({ name: 't', rect: rect(10, 20, 60, 16) }),
      ],
    });
    const { ops } = emitFigmaOps(root, [{ family: 'Inter', weight: 400, italic: false }]);
    expect(ops.map((o) => o.id)).toEqual([0, 1, 2]);
    expect(ops[0].type).toBe('frame');
    expect(ops[1].parent).toBe(0);
    expect(ops[2].parent).toBe(0);
    expect(ops[1].x).toBe(50);
    expect(ops[1].y).toBe(60);
    expect(ops[2].x).toBe(10);
  });

  it('marks children of auto-layout frames as flowed', () => {
    const root = frame({
      layout: {
        direction: 'HORIZONTAL',
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        itemSpacing: 8,
        primaryAxis: 'MIN',
        counterAxis: 'MIN',
      },
      children: [frame({ name: 'a' }), frame({ name: 'b' })],
    });
    const { ops } = emitFigmaOps(root, []);
    expect(ops[1].flowed).toBe(true);
    expect(ops[2].flowed).toBe(true);
    expect(ops[0].layout?.itemSpacing).toBe(8);
  });

  it('resolves each text node to its font index', () => {
    const fonts = [
      { family: 'Inter', weight: 400, italic: false },
      { family: 'Inter', weight: 700, italic: false },
    ];
    const root = frame({ children: [text({ fontWeight: 700 })] });
    const { ops, fonts: entries } = emitFigmaOps(root, fonts);
    expect(ops[1].text?.fontIndex).toBe(1);
    expect(entries[1].styles[0]).toBe('Bold');
  });

  it('carries image srcs and rect labels', () => {
    const img: ImageDesignNode = {
      kind: 'image',
      name: 'img',
      rect: rect(),
      opacity: 1,
      fills: [],
      src: 'https://x/y.png',
    };
    const root = frame({ children: [img] });
    const { ops } = emitFigmaOps(root, []);
    expect(ops[1].type).toBe('image');
    expect(ops[1].src).toBe('https://x/y.png');
  });
});

describe('renderPluginBundle', () => {
  it('emits a manifest, executable code.js, and readme', () => {
    const root = frame({ children: [text()] });
    const bundle = renderPluginBundle(root, [{ family: 'Inter', weight: 400, italic: false }], {
      name: 'Test Page',
      sourceUrl: 'http://localhost:3001',
    });
    expect(Object.keys(bundle).sort()).toEqual(['README.md', 'code.js', 'manifest.json']);

    const manifest = JSON.parse(bundle['manifest.json']) as Record<string, unknown>;
    expect(manifest.main).toBe('code.js');
    expect(manifest.name).toContain('Test Page');

    const code = bundle['code.js'];
    expect(code).toContain('const OPS = [');
    expect(code).toContain('"characters":"Hello"');
    expect(code).toContain('figma.loadFontAsync');
    expect(code).toContain('figma.closePlugin');
    expect(code).toContain('http://localhost:3001');

    // The generated executor is itself valid JS.
    expect(() => new Function('figma', code)).not.toThrow();
  });
});

/**
 * Runs the generated code.js against a stub of the Figma plugin API — enough
 * surface to execute the executor end to end and observe what it asked for.
 */
async function runPlugin(code: string): Promise<{ created: Array<Record<string, unknown>>; fontLoads: string[]; closed: string }> {
  const created: Array<Record<string, unknown>> = [];
  const fontLoads: string[] = [];
  let resolveClosed: (msg: string) => void = () => undefined;
  const closed = new Promise<string>((resolve) => {
    resolveClosed = resolve;
  });
  const make = (type: string) => () => {
    const node: Record<string, unknown> = {
      type,
      children: [] as unknown[],
      appendChild(child: unknown) {
        (this.children as unknown[]).push(child);
      },
      resize(w: number, h: number) {
        this.width = w;
        this.height = h;
      },
    };
    created.push(node);
    return node;
  };
  const figma = {
    currentPage: { appendChild: () => undefined },
    viewport: { scrollAndZoomIntoView: () => undefined },
    createFrame: make('FRAME'),
    createText: make('TEXT'),
    createRectangle: make('RECTANGLE'),
    createImageAsync: async () => ({ hash: 'h' }),
    loadFontAsync: async (f: { family: string; style: string }) => {
      fontLoads.push(`${f.family} ${f.style}`);
    },
    closePlugin: (msg: string) => resolveClosed(msg),
  };
  new Function('figma', 'console', code)(figma, { error: () => undefined });
  return { created, fontLoads, closed: await closed };
}

describe('generated code.js — #409', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('loads each font once, however many text layers use it', async () => {
    const root = frame({ children: [text(), text({ characters: 'Again' }), text({ characters: 'Thrice' })] });
    const bundle = renderPluginBundle(root, [{ family: 'Inter', weight: 400, italic: false }], { name: 'Fonts' });
    const { fontLoads, closed } = await runPlugin(bundle['code.js']);
    expect(closed).toContain('Imported 4 layers');
    expect(fontLoads).toEqual(['Inter Regular']);
  });

  it('applies wrapping auto-layout', async () => {
    const root = frame({
      layout: {
        direction: 'HORIZONTAL',
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        itemSpacing: 8,
        counterAxisSpacing: 12,
        wrap: true,
        primaryAxis: 'MIN',
        counterAxis: 'MIN',
      },
      children: [frame({ name: 'a' }), frame({ name: 'b' })],
    });
    const { ops } = emitFigmaOps(root, []);
    expect(ops[0].layout).toMatchObject({ wrap: true, counterAxisSpacing: 12 });
    const { created } = await runPlugin(renderPluginBundle(root, [], { name: 'Wrap' })['code.js']);
    expect(created[0]).toMatchObject({ layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP', counterAxisSpacing: 12 });
  });

  it('declares the manifest fields current Figma requires of a new plugin', () => {
    const manifest = JSON.parse(renderPluginBundle(frame(), [], { name: 'M' })['manifest.json']) as Record<string, unknown>;
    expect(manifest.documentAccess).toBe('dynamic-page');
    // Image fills fetch the captured page's own image URLs.
    expect(manifest.networkAccess).toMatchObject({ allowedDomains: ['*'] });
    expect(typeof (manifest.networkAccess as { reasoning?: unknown }).reasoning).toBe('string');
  });
});
