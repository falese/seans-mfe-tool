/**
 * Every OpenAPI spec the meridian-station fleet carries must be a valid
 * OpenAPI document (#444). `decompose:propose --spec` validates the specs it
 * uses; two unquoted commas inside flow mappings had made the source specs and
 * their per-MFE copies fail it.
 */

import * as fs from 'fs';
import * as path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';

const STATION = path.resolve(__dirname, '..', '..', 'examples', 'meridian-station');

function specFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (path.basename(path.dirname(p)) === 'specs' && /\.ya?ml$/.test(entry.name)) out.push(p);
    }
  };
  walk(STATION);
  return out.sort();
}

describe('meridian-station OpenAPI specs (#444)', () => {
  const files = specFiles();

  it('finds the specs', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files.map((f) => [path.relative(STATION, f), f]))('%s is valid OpenAPI', async (_name, file) => {
    await expect(SwaggerParser.validate(file)).resolves.toBeDefined();
  });
});
