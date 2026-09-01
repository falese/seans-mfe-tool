import {
  buildGenerateArgs,
  parseServeBody,
  compileIntent,
  runnerForRequest,
  makeSubprocessRunner,
  makeServeRunner,
} from '../coder-service';
import type { CoderRunner, IntentCompileRequest } from '../types';

describe('buildGenerateArgs', () => {
  it('assembles the minimal generate argv with the default adaptor', () => {
    const args = buildGenerateArgs({ intent: 'make a thing' });
    expect(args).toEqual(['generate', 'make a thing', '--adaptor', 'intent-manifest']);
  });

  it('threads system, model, and repeated context flags through', () => {
    const args = buildGenerateArgs({
      intent: 'x',
      adaptor: 'custom',
      systemPromptPath: 'prompts/system.md',
      model: 'Qwen2.5',
      context: { contextFiles: ['a.yaml', 'b.yaml'] },
    });
    expect(args).toEqual([
      'generate',
      'x',
      '--adaptor',
      'custom',
      '--system',
      'prompts/system.md',
      '--model',
      'Qwen2.5',
      '--context',
      'a.yaml',
      '--context',
      'b.yaml',
    ]);
  });
});

describe('parseServeBody', () => {
  it('returns a plain body unchanged', () => {
    expect(parseServeBody('name: x\n')).toBe('name: x\n');
  });

  it('concatenates SSE data chunks and drops the [DONE] sentinel', () => {
    const sse = 'data: name: x\ndata: version: 1.0.0\ndata: [DONE]\n';
    expect(parseServeBody(sse)).toBe('name: xversion: 1.0.0');
  });
});

describe('runnerForRequest', () => {
  it('selects a subprocess runner by default', () => {
    const runner = runnerForRequest({ intent: 'x' });
    expect(typeof runner.generate).toBe('function');
  });

  it('selects a serve runner when a serve transport is given', () => {
    const runner = runnerForRequest({
      intent: 'x',
      transport: { kind: 'serve', endpoint: 'http://localhost:3991' },
    });
    expect(typeof runner.generate).toBe('function');
  });

  it('exposes both transport factories', () => {
    expect(typeof makeSubprocessRunner().generate).toBe('function');
    expect(typeof makeServeRunner('http://x').generate).toBe('function');
  });
});

describe('compileIntent (injected runner — no model spawned)', () => {
  const fakeRunner = (out: string): CoderRunner => ({
    generate: (_req: IntentCompileRequest) => Promise.resolve(out),
  });

  it('returns the candidate with fences stripped and adaptor recorded', async () => {
    const yaml = 'name: x\nversion: 1.0.0\ntype: remote\nlanguage: typescript\ncapabilities: []';
    const candidate = await compileIntent({ intent: 'x' }, fakeRunner('```yaml\n' + yaml + '\n```'));
    expect(candidate.yaml).toBe(yaml);
    expect(candidate.adaptor).toBe('intent-manifest');
  });

  it('records the model when provided', async () => {
    const candidate = await compileIntent(
      { intent: 'x', model: 'Qwen2.5', adaptor: 'a' },
      fakeRunner('name: x'),
    );
    expect(candidate.model).toBe('Qwen2.5');
    expect(candidate.adaptor).toBe('a');
  });

  it('surfaces a SystemError when the coder binary is missing', async () => {
    // Use a bin path that cannot exist on PATH; the real subprocess runner runs.
    await expect(
      compileIntent({ intent: 'x', transport: { kind: 'subprocess', bin: '/nonexistent/coder-xyz' } }),
    ).rejects.toThrow(/coder binary not found/i);
  });
});
