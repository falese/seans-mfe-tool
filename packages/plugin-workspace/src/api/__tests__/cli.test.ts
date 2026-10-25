import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { makeCliRunner } from '../cli';

/** A stand-in CLI: echoes its arguments in an envelope, after noise on stdout the way oclif warnings can be. */
function fakeBin(body: string): string[] {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fake-cli-')), 'cli.js');
  fs.writeFileSync(file, body);
  return [process.execPath, file];
}

describe('makeCliRunner', () => {
  beforeEach(() => jest.useRealTimers());

  it('runs one command and returns the envelope it printed last', async () => {
    const run = makeCliRunner(fakeBin(`console.log('noise'); console.log(JSON.stringify({ ok: true, data: process.argv.slice(2), warnings: [], telemetry: { durationMs: 1, correlationId: 'c' } }));`));
    await expect(run.run(['decompose:status', '/p', '--json'])).resolves.toMatchObject({ ok: true, data: ['decompose:status', '/p', '--json'] });
  });

  it('returns a failing envelope as it is, whatever the exit code', async () => {
    const run = makeCliRunner(fakeBin(`console.log(JSON.stringify({ ok: false, error: { type: 'ValidationError', code: 2, message: 'nope', retryable: false, userFacing: true }, warnings: [], telemetry: { durationMs: 1, correlationId: 'c' } })); process.exit(2);`));
    await expect(run.run(['decompose:edit'])).resolves.toMatchObject({ ok: false, error: { message: 'nope' } });
  });

  it('turns a command that printed no envelope into a typed failure naming stderr', async () => {
    const run = makeCliRunner(fakeBin(`console.error('boom'); process.exit(1);`));
    await expect(run.run(['decompose:edit'])).resolves.toMatchObject({ ok: false, error: { type: 'SystemError', message: expect.stringContaining('boom') } });
  });
});
