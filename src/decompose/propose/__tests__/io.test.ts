import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readAnswerKey } from '../io';

describe('readAnswerKey', () => {
  it('reads a behavior written with ": " back as text — YAML parses it as a one-entry map', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'key-'));
    const file = path.join(dir, 'answer-key.yaml');
    fs.writeFileSync(file, 'domains: []\nfiles: {}\nuntested_behaviors:\n  - TrafficLog sorting\n  - Routing: each path renders the right pair\n');
    const key = await readAnswerKey(file);
    expect(key.untested_behaviors).toEqual(['TrafficLog sorting', 'Routing: each path renders the right pair']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
