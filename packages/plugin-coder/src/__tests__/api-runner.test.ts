import { z } from 'zod';
import { AuthenticationError, RateLimitError, APIConnectionError } from '@anthropic-ai/sdk';
import { BusinessError, NetworkError, SecurityError, ValidationError } from '@seans-mfe/contracts';
import {
  DEFAULT_API_MODEL,
  FALLBACK_BETA,
  anthropicClient,
  makeApiRunner,
  runPromptAdaptor,
  type MessagesClient,
  type PromptAdaptor,
} from '../api-runner';
import { runnerForRequest } from '../coder-service';

const Answer = z.object({ answer: z.string() });

const adaptor: PromptAdaptor<{ doc: string; ask: string }, z.infer<typeof Answer>> = {
  id: 'test-adaptor',
  version: '1',
  system: 'You answer.',
  assemble: (input) => ({ context: `DOC:\n${input.doc}`, request: input.ask }),
  output: Answer,
};

/** A client whose `beta.messages.parse` records its params and returns `reply`. */
function fakeClient(reply: unknown | (() => never)): { client: MessagesClient; calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  const parse = async (params: Record<string, unknown>) => {
    calls.push(params);
    if (typeof reply === 'function') return (reply as () => never)();
    return reply;
  };
  return { client: { beta: { messages: { parse } } } as unknown as MessagesClient, calls };
}

const ok = (parsed: unknown, extra: Record<string, unknown> = {}) => ({
  model: DEFAULT_API_MODEL,
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(parsed) }],
  parsed_output: parsed,
  usage: { input_tokens: 10, output_tokens: 5 },
  ...extra,
});

describe('runPromptAdaptor', () => {
  it('sends the stable parts first and cached, the request last, with structured output and server-side fallbacks', async () => {
    const { client, calls } = fakeClient(ok({ answer: 'yes' }));
    const result = await runPromptAdaptor(adaptor, { doc: 'd', ask: 'q?' }, { client });

    expect(result.output).toEqual({ answer: 'yes' });
    expect(result.model).toBe(DEFAULT_API_MODEL);
    const params = calls[0];
    expect(params.model).toBe(DEFAULT_API_MODEL);
    expect(params.betas).toEqual([FALLBACK_BETA]);
    expect(params.fallbacks).toBe('default');
    expect(params.system).toEqual([{ type: 'text', text: 'You answer.', cache_control: { type: 'ephemeral' } }]);
    expect(params.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'DOC:\nd', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'q?' },
        ],
      },
    ]);
    const config = params.output_config as { format: { type: string; schema: unknown } };
    expect(config.format.type).toBe('json_schema');
    expect(params).not.toHaveProperty('tool_choice');
  });

  it('uses the model it is given and reports the model that answered', async () => {
    const { client, calls } = fakeClient(ok({ answer: 'yes' }, { model: 'fallback-model' }));
    const result = await runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client, model: 'other-model' });
    expect(calls[0].model).toBe('other-model');
    expect(result.model).toBe('fallback-model');
  });

  it('turns a refusal into a typed error before reading any content', async () => {
    const { client } = fakeClient({ model: DEFAULT_API_MODEL, stop_reason: 'refusal', content: [], parsed_output: null });
    await expect(runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client })).rejects.toThrow(BusinessError);
    await expect(runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client })).rejects.toThrow(/declined/);
  });

  it('reports an answer cut off at max_tokens instead of parsing half of it', async () => {
    const { client } = fakeClient({ model: DEFAULT_API_MODEL, stop_reason: 'max_tokens', content: [], parsed_output: null });
    await expect(runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client })).rejects.toThrow(/cut off/);
  });

  it('refuses an answer that does not match the adaptor’s schema', async () => {
    const { client } = fakeClient(ok({ nope: 1 }, { parsed_output: { nope: 1 } }));
    await expect(runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client })).rejects.toThrow(BusinessError);
  });

  it('maps the provider’s errors onto the platform’s typed errors', async () => {
    const auth = fakeClient(() => {
      throw new AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, undefined, new Headers());
    });
    const refused = await runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client: auth.client }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(SecurityError);
    // In words a product owner can act on: the provider's own reason, and what to check — not its JSON body.
    expect((refused as Error).message).toBe('the model provider refused the key (invalid x-api-key) — check ANTHROPIC_API_KEY');

    const limited = fakeClient(() => {
      throw new RateLimitError(429, {}, 'slow down', new Headers());
    });
    const err = await runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client: limited.client }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).statusCode).toBe(429);

    const down = fakeClient(() => {
      throw new APIConnectionError({ message: 'ECONNRESET' });
    });
    await expect(runPromptAdaptor(adaptor, { doc: 'd', ask: 'q' }, { client: down.client })).rejects.toThrow(NetworkError);
  });
});

describe('anthropicClient', () => {
  it('names the variable to set when there is no key in the environment', () => {
    expect(() => anthropicClient({})).toThrow(ValidationError);
    expect(() => anthropicClient({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('builds a client from the key in the environment', () => {
    expect(anthropicClient({ ANTHROPIC_API_KEY: 'sk-test' })).toBeDefined();
  });
});

describe('the api transport', () => {
  it('is what runnerForRequest picks for { kind: "api" }', () => {
    const runner = runnerForRequest({ intent: 'x', transport: { kind: 'api', provider: 'anthropic' } });
    expect(typeof runner.generate).toBe('function');
  });

  it('returns the model’s text for an intent, the way the other transports do', async () => {
    const calls: Record<string, unknown>[] = [];
    const client = {
      beta: {
        messages: {
          create: async (params: Record<string, unknown>) => {
            calls.push(params);
            return { model: DEFAULT_API_MODEL, stop_reason: 'end_turn', content: [{ type: 'text', text: 'name: x\n' }] };
          },
        },
      },
    } as unknown as MessagesClient;
    const runner = makeApiRunner({ kind: 'api', provider: 'anthropic' }, client);
    await expect(runner.generate({ intent: 'a page that lists crew' })).resolves.toBe('name: x\n');
    expect(calls[0].messages).toEqual([{ role: 'user', content: 'a page that lists crew' }]);
    expect(calls[0].fallbacks).toBe('default');
  });
});
