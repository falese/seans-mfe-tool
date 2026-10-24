import { decodePng, diffRegion, type Image } from '../png';
import { encodePng } from './encode-png';

function image(width: number, height: number, px: (x: number, y: number) => [number, number, number, number]): Image {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(px(x, y), (y * width + x) * 4);
  return { width, height, data };
}

const gradient = image(7, 5, (x, y) => [x * 30, y * 50, (x * y * 13) % 256, 255]);

describe('decodePng', () => {
  it('decodes RGBA through every filter type', () => {
    const decoded = decodePng(encodePng(gradient, { filters: [0, 1, 2, 3, 4] }));
    expect(decoded.width).toBe(7);
    expect(Buffer.from(decoded.data)).toEqual(Buffer.from(gradient.data));
  });
  it('decodes RGB as opaque RGBA', () => {
    expect(Buffer.from(decodePng(encodePng(gradient, { channels: 3, filters: [4, 3] })).data)).toEqual(Buffer.from(gradient.data));
  });
  it('refuses what it does not decode, rather than misreading it', () => {
    expect(() => decodePng(Buffer.from('not a png'))).toThrow(/not a PNG/);
    const png = encodePng(gradient);
    png[24] = 16; // bit depth
    expect(() => decodePng(png)).toThrow(/8-bit/);
  });
});

describe('diffRegion', () => {
  const white = image(10, 10, () => [255, 255, 255, 255]);
  const dotted = image(10, 10, (x, y) => (x === 2 && y === 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
  it('counts differing pixels inside the region only', () => {
    expect(diffRegion(white, { x: 0, y: 0, width: 5, height: 5 }, dotted, { x: 0, y: 0, width: 5, height: 5 })).toEqual({ pixels: 25, differing: 1 });
    expect(diffRegion(white, { x: 5, y: 5, width: 5, height: 5 }, dotted, { x: 5, y: 5, width: 5, height: 5 })).toEqual({ pixels: 25, differing: 0 });
  });
  it('compares a region that moved by its own content, not by page position', () => {
    expect(diffRegion(dotted, { x: 1, y: 1, width: 3, height: 3 }, dotted, { x: 1, y: 1, width: 3, height: 3 }).differing).toBe(0);
    const shifted = image(10, 10, (x, y) => (x === 4 && y === 6 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    expect(diffRegion(dotted, { x: 1, y: 1, width: 3, height: 3 }, shifted, { x: 3, y: 5, width: 3, height: 3 }).differing).toBe(0);
  });
  it('ignores rendering noise but not a subtle colour change, and counts a changed size as all different', () => {
    const near = image(10, 10, () => [252, 252, 252, 255]);
    const subtle = image(10, 10, () => [242, 246, 245, 255]);
    expect(diffRegion(white, { x: 0, y: 0, width: 10, height: 10 }, near, { x: 0, y: 0, width: 10, height: 10 }).differing).toBe(0);
    expect(diffRegion(white, { x: 0, y: 0, width: 10, height: 10 }, near, { x: 0, y: 0, width: 10, height: 10 }, { tolerance: 2 }).differing).toBe(100);
    // A colour moved by 9–13 per channel is a change.
    expect(diffRegion(white, { x: 0, y: 0, width: 10, height: 10 }, subtle, { x: 0, y: 0, width: 10, height: 10 }).differing).toBe(100);
    expect(diffRegion(white, { x: 0, y: 0, width: 4, height: 4 }, white, { x: 0, y: 0, width: 4, height: 5 })).toEqual({ pixels: 16, differing: 16 });
  });
  it('skips the pixels of nested regions, so a change counts once, in the region that drew it', () => {
    const inner = { x: 1, y: 1, width: 3, height: 3 };
    expect(diffRegion(white, { x: 0, y: 0, width: 5, height: 5 }, dotted, { x: 0, y: 0, width: 5, height: 5 }, { exclude: [inner] })).toEqual({ pixels: 16, differing: 0 });
  });
  it('clips a region to the screenshot', () => {
    expect(diffRegion(white, { x: 8, y: 8, width: 5, height: 5 }, white, { x: 8, y: 8, width: 5, height: 5 })).toEqual({ pixels: 4, differing: 0 });
  });
});
