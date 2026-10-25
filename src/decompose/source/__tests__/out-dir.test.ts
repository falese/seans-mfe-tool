import * as path from 'path';
import { analysisOutDir } from '../out-dir';

describe('analysisOutDir — where decompose:analyze writes', () => {
  it('writes into the capture it joins, so one bundle holds both', () => {
    expect(analysisOutDir({ evidence: '/work/ev' })).toEqual({ dir: path.resolve('/work/ev/source') });
  });

  it('honours --out', () => {
    expect(analysisOutDir({ evidence: '/work/ev', out: '/elsewhere' })).toEqual({ dir: path.resolve('/elsewhere') });
  });

  it('warns when nothing joins it to a capture, because no observed call can then be explained', () => {
    const { dir, warning } = analysisOutDir({});
    expect(dir).toBe(path.resolve('./evidence/source'));
    expect(warning).toMatch(/not joined to a capture/);
    expect(warning).toMatch(/--evidence <bundle>/);
  });
});
