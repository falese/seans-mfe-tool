import { decodePng } from '../../decompose/verify/png';
import { baselinePng, cropMasked, encodePng, MASK_RGBA } from '../png';

const img = (width: number, height: number, at: (x: number, y: number) => number[]) => {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(at(x, y), (y * width + x) * 4);
  return { width, height, data };
};

describe('visual baselines', () => {
  const page = img(8, 6, (x, y) => [x * 10, y * 10, 7, 255]);

  it('round-trips through the decoder the parity gate uses', () => {
    const back = decodePng(encodePng(page));
    expect(back.width).toBe(8);
    expect(Array.from(back.data)).toEqual(Array.from(page.data));
  });

  it('cuts the capability’s rectangle and paints nested placements the mask colour', () => {
    const out = cropMasked(page, { x: 2, y: 1, width: 4, height: 3 }, [{ x: 3, y: 2, width: 1, height: 1 }]);
    const px = (x: number, y: number) => Array.from(out.data.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
    expect(px(0, 0)).toEqual([20, 10, 7, 255]);
    expect(px(1, 1)).toEqual(MASK_RGBA);
    expect(px(3, 2)).toEqual([50, 30, 7, 255]);
  });

  it('writes a PNG from a screenshot', () => {
    const png = baselinePng(encodePng(page), { x: 0, y: 0, width: 2, height: 2 }, []);
    expect(decodePng(png).width).toBe(2);
  });
});
