import { buildDesignTree, parseColor, parseBoxShadow, firstFontFamily, px } from '../design-tree';
import type { RawRecord } from '../design-tree';

const rect = (x = 0, y = 0, width = 100, height = 50) => ({ x, y, width, height });

function el(overrides: Partial<RawRecord>): RawRecord {
  return {
    kind: 'element',
    parentIndex: 0,
    tag: 'div',
    rect: rect(),
    styles: {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      'overflow-x': 'visible',
      'overflow-y': 'visible',
    },
    ...overrides,
  };
}

function txt(overrides: Partial<RawRecord>): RawRecord {
  return {
    kind: 'text',
    parentIndex: 0,
    text: 'Hello',
    rect: rect(0, 0, 50, 16),
    styles: {
      color: 'rgb(10, 20, 30)',
      'font-family': '"Inter", sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'font-style': 'normal',
      'line-height': 'normal',
      'text-align': 'left',
      'letter-spacing': 'normal',
      'text-decoration-line': 'none',
      opacity: '1',
      visibility: 'visible',
    },
    ...overrides,
  };
}

const ROOT = el({ parentIndex: -1, tag: 'body', rect: rect(0, 0, 800, 600) });

describe('parse helpers', () => {
  it('parses rgb/rgba with alpha', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(parseColor('rgba(0, 128, 255, 0.5)')).toEqual({ r: 0, g: 128 / 255, b: 1, a: 0.5 });
    expect(parseColor('rgba(0,0,0,0)')).toBeUndefined();
    expect(parseColor('transparent')).toBeUndefined();
  });

  it('parses hex colors', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.5, 2);
  });

  it('parses the first box-shadow layer', () => {
    expect(parseBoxShadow('rgba(0,0,0,0.2) 0px 4px 12px 2px')).toEqual({
      x: 0,
      y: 4,
      blur: 12,
      spread: 2,
      inner: false,
      color: { r: 0, g: 0, b: 0, a: 0.2 },
    });
    expect(parseBoxShadow('none')).toBeUndefined();
    expect(parseBoxShadow('inset rgb(0,0,0) 1px 1px 0px')?.inner).toBe(true);
  });

  it('reads first font family and px values', () => {
    expect(firstFontFamily('"Segoe UI", Roboto, sans-serif')).toBe('Segoe UI');
    expect(firstFontFamily('Inter')).toBe('Inter');
    expect(px('12.5px')).toBe(12.5);
    expect(px('auto')).toBe(0);
  });
});

describe('buildDesignTree', () => {
  it('culls invisible and zero-size records', () => {
    const hidden = el({ styles: { display: 'none' } });
    const zero = el({ rect: rect(0, 0, 0, 0) });
    const shown = el({ id: 'ok' });
    const { root, stats } = buildDesignTree([ROOT, hidden, zero, shown]);
    expect(root.children.map((c) => c.name)).toEqual(['div#ok']);
    expect(stats.elements).toBe(2); // root + shown
  });

  it('maps img to image nodes and svg/canvas to placeholders', () => {
    const img = el({ tag: 'img', src: 'https://x/y.png' });
    const svg = el({ tag: 'svg' });
    const { root, stats } = buildDesignTree([ROOT, img, svg]);
    const kinds = root.children.map((c) => c.kind);
    expect(kinds).toEqual(['image', 'rect']);
    const svgNode = root.children[1];
    expect(svgNode.kind).toBe('rect');
    if (svgNode.kind === 'rect') expect(svgNode.label).toBe('svg');
    expect(stats.images).toBe(1);
    expect(stats.placeholders).toBe(1);
  });

  it('attaches text runs to their parent element and collects fonts', () => {
    const parent = el({});
    const t = txt({ parentIndex: 1 });
    const { root, fonts, stats } = buildDesignTree([ROOT, parent, t]);
    const frame = root.children[0];
    expect(frame.kind).toBe('frame');
    if (frame.kind === 'frame') {
      expect(frame.children[0].kind).toBe('text');
      const tn = frame.children[0];
      if (tn.kind === 'text') {
        expect(tn.characters).toBe('Hello');
        expect(tn.fontFamily).toBe('Inter');
        expect(tn.fontWeight).toBe(400);
      }
    }
    expect(stats.texts).toBe(1);
    expect(fonts).toEqual([{ family: 'Inter', weight: 400, italic: false }]);
  });

  it('marks flex containers with flowing children as auto-layout', () => {
    const flex = el({
      styles: {
        display: 'flex',
        'flex-direction': 'row',
        'justify-content': 'center',
        'align-items': 'flex-end',
        'column-gap': '8px',
        'padding-top': '4px',
        'padding-right': '6px',
        'padding-bottom': '4px',
        'padding-left': '6px',
        'overflow-x': 'visible',
        'overflow-y': 'visible',
      },
    });
    const kidA = el({ parentIndex: 1 });
    const kidB = el({ parentIndex: 1 });
    const { root } = buildDesignTree([ROOT, flex, kidA, kidB]);
    const frame = root.children[0];
    expect(frame.kind).toBe('frame');
    if (frame.kind === 'frame') {
      expect(frame.layout).toEqual({
        direction: 'HORIZONTAL',
        paddingTop: 4,
        paddingRight: 6,
        paddingBottom: 4,
        paddingLeft: 6,
        itemSpacing: 8,
        primaryAxis: 'CENTER',
        counterAxis: 'MAX',
      });
    }
  });

  it('falls back to absolute positioning when a flex child has margins', () => {
    const flex = el({ styles: { display: 'flex' } });
    const margined = el({ parentIndex: 1, styles: { 'margin-left': '10px' } });
    const { root } = buildDesignTree([ROOT, flex, margined]);
    const frame = root.children[0];
    if (frame.kind === 'frame') expect(frame.layout).toBeUndefined();
  });

  it('falls back for absolutely positioned children', () => {
    const flex = el({ styles: { display: 'flex' } });
    const abs = el({ parentIndex: 1, styles: { position: 'absolute' } });
    const { root } = buildDesignTree([ROOT, flex, abs]);
    const frame = root.children[0];
    if (frame.kind === 'frame') expect(frame.layout).toBeUndefined();
  });

  it('drops descendants beyond maxDepth and counts them', () => {
    const a = el({ parentIndex: 0 });
    const b = el({ parentIndex: 1 });
    const c = el({ parentIndex: 2 });
    const { root, stats } = buildDesignTree([ROOT, a, b, c], { maxDepth: 1 });
    const frameA = root.children[0];
    expect(frameA.kind).toBe('frame');
    if (frameA.kind === 'frame') expect(frameA.children).toHaveLength(0);
    expect(stats.truncated).toBe(1);
  });

  it('carries background fills, borders, radii and shadows onto frames', () => {
    const styled = el({
      styles: {
        display: 'block',
        'background-color': 'rgba(255, 0, 0, 0.8)',
        'border-top-width': '2px',
        'border-top-color': 'rgb(0,0,0)',
        'border-top-style': 'dashed',
        'border-top-left-radius': '8px',
        'box-shadow': 'rgba(0,0,0,0.3) 1px 2px 4px 0px',
        'overflow-x': 'hidden',
      },
    });
    const { root } = buildDesignTree([ROOT, styled]);
    const frame = root.children[0];
    expect(frame.fills[0]).toEqual({ r: 1, g: 0, b: 0, a: 0.8 });
    expect(frame.strokeWeights?.top).toBe(2);
    expect(frame.strokeDashed).toBe(true);
    expect(frame.cornerRadius?.tl).toBe(8);
    expect(frame.effects?.[0]).toMatchObject({ x: 1, y: 2, blur: 4, inner: false });
    if (frame.kind === 'frame') expect(frame.clipsContent).toBe(true);
  });
});

describe('buildDesignTree — #409 capture fidelity', () => {
  const flexStyles = (extra: Record<string, string>) => ({
    display: 'flex',
    'overflow-x': 'visible',
    'overflow-y': 'visible',
    ...extra,
  });

  it('treats a zero-size display:contents wrapper as transparent and keeps its subtree', () => {
    const contents = el({ rect: rect(0, 0, 0, 0), styles: { display: 'contents' } });
    const p = el({ parentIndex: 1, tag: 'p', rect: rect(0, 0, 200, 20) });
    const t = txt({ parentIndex: 2, text: 'text' });
    const { root } = buildDesignTree([ROOT, contents, p, t]);
    expect(root.children.map((c) => c.name)).toEqual(['p']);
    const pNode = root.children[0];
    if (pNode.kind === 'frame') expect(pNode.children[0]).toMatchObject({ kind: 'text', characters: 'text' });
  });

  it('keeps document order when a transparent wrapper sits between siblings', () => {
    const a = el({ id: 'a' });
    const contents = el({ rect: rect(0, 0, 0, 0), styles: { display: 'contents' } });
    const b = el({ parentIndex: 2, id: 'b' });
    const c = el({ id: 'c' });
    const { root } = buildDesignTree([ROOT, a, contents, b, c]);
    expect(root.children.map((n) => n.name)).toEqual(['div#a', 'div#b', 'div#c']);
  });

  it('drops the subtree of a zero-size element that clips its content', () => {
    const clipper = el({
      rect: rect(0, 0, 0, 0),
      styles: { display: 'block', 'overflow-x': 'hidden', 'overflow-y': 'hidden' },
    });
    const inside = el({ parentIndex: 1, id: 'clipped' });
    const { root } = buildDesignTree([ROOT, clipper, inside]);
    expect(root.children).toHaveLength(0);
  });

  it('carries the opacity of a transparent wrapper onto the children it hands up', () => {
    const faded = el({
      rect: rect(0, 0, 0, 0),
      styles: { display: 'block', opacity: '0.5', 'overflow-x': 'visible', 'overflow-y': 'visible' },
    });
    const kid = el({ parentIndex: 1, styles: { display: 'block', opacity: '0.8' } });
    const { root } = buildDesignTree([ROOT, faded, kid]);
    expect(root.children[0].opacity).toBeCloseTo(0.4, 5);
  });

  it('applies opacity once to direct text — the frame carries it, the text does not', () => {
    const faded = el({ styles: { display: 'block', opacity: '0.5' } });
    // A capture from before the fix copied the parent's opacity onto the text record.
    const t = txt({ parentIndex: 1, styles: { ...txt({}).styles, opacity: '0.5' } });
    const { root } = buildDesignTree([ROOT, faded, t]);
    const frameNode = root.children[0];
    expect(frameNode.opacity).toBe(0.5);
    if (frameNode.kind === 'frame') expect(frameNode.children[0].opacity).toBe(1);
  });

  it('maps a wrapping row to wrapping auto-layout with the row gap as counter-axis spacing', () => {
    const flex = el({
      styles: flexStyles({ 'flex-direction': 'row', 'flex-wrap': 'wrap', 'column-gap': '8px', 'row-gap': '12px' }),
    });
    const { root } = buildDesignTree([ROOT, flex, el({ parentIndex: 1 }), el({ parentIndex: 1 })]);
    const frameNode = root.children[0];
    if (frameNode.kind !== 'frame') throw new Error('expected a frame');
    expect(frameNode.layout).toMatchObject({ direction: 'HORIZONTAL', wrap: true, itemSpacing: 8, counterAxisSpacing: 12 });
  });

  it('keeps absolute coordinates for wrapping layouts auto-layout cannot express', () => {
    for (const extra of [
      { 'flex-direction': 'column', 'flex-wrap': 'wrap' },
      { 'flex-direction': 'row', 'flex-wrap': 'wrap-reverse' },
    ]) {
      const flex = el({ styles: flexStyles(extra) });
      const { root } = buildDesignTree([ROOT, flex, el({ parentIndex: 1 })]);
      const frameNode = root.children[0];
      if (frameNode.kind === 'frame') expect(frameNode.layout).toBeUndefined();
    }
  });

  it('reverses child order and the primary axis for row-reverse / column-reverse', () => {
    const cases: Array<[string, string | undefined, string]> = [
      ['row-reverse', undefined, 'MAX'],
      ['row-reverse', 'flex-end', 'MIN'],
      ['column-reverse', 'flex-start', 'MAX'],
      ['row-reverse', 'center', 'CENTER'],
      ['row-reverse', 'space-between', 'SPACE_BETWEEN'],
    ];
    for (const [direction, justify, expected] of cases) {
      const styles = flexStyles({ 'flex-direction': direction });
      if (justify) styles['justify-content'] = justify;
      const flex = el({ styles });
      const { root } = buildDesignTree([ROOT, flex, el({ parentIndex: 1, id: 'first' }), el({ parentIndex: 1, id: 'second' })]);
      const frameNode = root.children[0];
      if (frameNode.kind !== 'frame') throw new Error('expected a frame');
      expect(frameNode.layout?.primaryAxis).toBe(expected);
      expect(frameNode.layout?.direction).toBe(direction.startsWith('row') ? 'HORIZONTAL' : 'VERTICAL');
      expect(frameNode.children.map((c) => c.name)).toEqual(['div#second', 'div#first']);
    }
  });

  it('culls records wholly outside the clip rect, keeping an inside child of an outside wrapper', () => {
    const viewport = { x: 0, y: 0, width: 800, height: 600 };
    const inside = el({ id: 'inside', rect: rect(10, 10, 100, 50) });
    const below = el({ id: 'below', rect: rect(0, 2000, 100, 50) });
    const belowText = txt({ parentIndex: 2, rect: rect(0, 2000, 50, 16) });
    const straddle = el({ id: 'straddle', rect: rect(0, 580, 100, 50) });
    const offscreenWrapper = el({ id: 'wrapper', rect: rect(-500, 0, 100, 50) });
    const poking = el({ parentIndex: 5, id: 'poking', rect: rect(20, 20, 40, 40), styles: { display: 'block', position: 'absolute' } });
    const records = [ROOT, inside, below, belowText, straddle, offscreenWrapper, poking];
    const { root, stats } = buildDesignTree(records, { clip: viewport });
    expect(root.children.map((c) => c.name)).toEqual(['div#inside', 'div#straddle', 'div#poking']);
    expect(stats.texts).toBe(0);
  });

  it('builds a 100k-record tree in linear time', () => {
    // The suite fakes timers (jest.config.js), which freezes Date.now.
    jest.useRealTimers();
    const records: RawRecord[] = [ROOT];
    // 20k sibling sections, each with an element child and two text runs.
    for (let i = 0; i < 20_000; i += 1) {
      const section = records.push(el({ parentIndex: 0, rect: rect(0, i * 10, 100, 10) })) - 1;
      const inner = records.push(el({ parentIndex: section, rect: rect(0, i * 10, 50, 10) })) - 1;
      records.push(txt({ parentIndex: section }));
      records.push(txt({ parentIndex: inner }));
      records.push(el({ parentIndex: inner, rect: rect(0, 0, 0, 0), styles: { display: 'contents' } }));
    }
    const started = Date.now();
    const { stats } = buildDesignTree(records);
    const elapsed = Date.now() - started;
    expect(stats.elements).toBe(40_001);
    expect(stats.texts).toBe(40_000);
    // Quadratic took ~66s at 50k layers (#409); linear is well under a second.
    expect(elapsed).toBeLessThan(3000);
  });
});
