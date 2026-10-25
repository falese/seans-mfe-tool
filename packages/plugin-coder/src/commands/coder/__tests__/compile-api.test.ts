import { coderCompileCommand } from '../compile';
import type { CoderRunner, IntentCompileRequest } from '../../../types';

describe('coder:compile --api (ADR-117 §1)', () => {
  it('sends the intent over the api transport', async () => {
    const seen: IntentCompileRequest[] = [];
    const runner: CoderRunner = {
      async generate(request) {
        seen.push(request);
        return 'name: x\n';
      },
    };
    await coderCompileCommand({ intent: 'a crew list', api: true, allowInvalid: true }, runner).catch(() => undefined);
    expect(seen[0].transport).toEqual({ kind: 'api', provider: 'anthropic' });
  });
});
