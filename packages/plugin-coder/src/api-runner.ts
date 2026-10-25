/**
 * The `api` transport (ADR-117 §1): the coder seam reaching a hosted model over
 * HTTPS instead of a local coder process. Anthropic's Messages API is the first
 * provider; the key comes from the environment, never a flag or a file.
 *
 * A hosted model loads no LoRA, so an adaptor on this transport is a **prompt
 * adaptor** (§2): a system prompt, a context assembler and an output schema.
 * The model answers in that schema through structured output — never free text
 * parsed by pattern — and whatever it answers is still only a candidate the
 * caller's oracle decides on (§4).
 */

import Anthropic, { APIConnectionError, APIError, AuthenticationError, PermissionDeniedError } from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { readFile } from 'node:fs/promises';
import type { z } from 'zod';
import { BusinessError, NetworkError, SecurityError, ValidationError } from '@seans-mfe/contracts';
import type { CoderRunner, CoderTransport, IntentCompileRequest } from './types';

/** The model an `api` request runs on unless the caller names another. */
export const DEFAULT_API_MODEL = 'claude-opus-5-5';

/**
 * Server-side fallback: a request the model declines is re-run on the
 * provider's recommended fallback model inside the same call, so a policy
 * decline is not the end of the question.
 */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const MAX_TOKENS = 16000;

/** The part of the SDK client the transport uses; injected in tests. */
export interface MessagesClient {
  beta: { messages: Pick<Anthropic['beta']['messages'], 'parse' | 'create'> };
}

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** A prompt adaptor (ADR-117 §2): data plus small pure functions, versioned with the contract it targets. */
export interface PromptAdaptor<Input, Output> {
  id: string;
  /** Bumped whenever the prompt or the schema changes: a prompt change is a behavior change. */
  version: string;
  /** What the task is and what the answer may contain. Stable, so it is cached. */
  system: string;
  /**
   * Builds the request: `context` is what stays the same between questions
   * about one document (cached), `request` is the question itself (sent last).
   */
  assemble(input: Input): { context: string; request: string };
  /** The only shape the model may answer in. */
  output: z.ZodType<Output>;
  effort?: Effort;
}

export interface AdaptorAnswer<Output> {
  output: Output;
  /** The model that answered — a fallback model when the first one declined. */
  model: string;
}

/**
 * A client for the key in the environment. Missing key → a typed error that
 * says what to set (ADR-117 §1).
 */
export function anthropicClient(env: NodeJS.ProcessEnv = process.env): Anthropic {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ValidationError(
      'no Anthropic API key — set ANTHROPIC_API_KEY in the environment to use the api transport',
      'ANTHROPIC_API_KEY',
      'set',
    );
  }
  return new Anthropic({ apiKey });
}

/** The provider's own reason, out of its error body; the SDK's message carries the whole JSON. */
function reason(err: APIError): string {
  const body = err.error as { error?: { message?: unknown } } | undefined;
  return typeof body?.error?.message === 'string' ? body.error.message : err.message;
}

/** The provider's errors as the platform's typed errors. */
function asTypedError(err: unknown): unknown {
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new SecurityError(`the model provider refused the key (${reason(err)}) — check ANTHROPIC_API_KEY`, { status: err.status });
  }
  if (err instanceof APIConnectionError) {
    return new NetworkError(`the model provider could not be reached: ${err.message}`, 503);
  }
  if (err instanceof APIError) {
    return new NetworkError(`the model provider answered ${err.status ?? 'an error'}: ${reason(err)}`, err.status ?? 500);
  }
  return err;
}

interface Stopped {
  stop_reason: string | null;
}

/** Refusals and truncated answers are reported before any content is read. */
function checkStop(response: Stopped, adaptorId: string): void {
  if (response.stop_reason === 'refusal') {
    throw new BusinessError('the model declined to answer this request', 'AGENT_DECLINED', { adaptor: adaptorId });
  }
  if (response.stop_reason === 'max_tokens') {
    throw new BusinessError('the model’s answer was cut off before it finished; ask a narrower question', 'AGENT_TRUNCATED', {
      adaptor: adaptorId,
    });
  }
}

const adaptorId = (a: { id: string; version: string }) => `${a.id}@${a.version}`;

/** Run a prompt adaptor once: one request, one typed answer. */
export async function runPromptAdaptor<Input, Output>(
  adaptor: PromptAdaptor<Input, Output>,
  input: Input,
  opts: { client: MessagesClient; model?: string },
): Promise<AdaptorAnswer<Output>> {
  const { context, request } = adaptor.assemble(input);
  let response;
  try {
    response = await opts.client.beta.messages.parse({
      model: opts.model ?? DEFAULT_API_MODEL,
      max_tokens: MAX_TOKENS,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system: [{ type: 'text', text: adaptor.system, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: request },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(adaptor.output), ...(adaptor.effort ? { effort: adaptor.effort } : {}) },
    });
  } catch (err) {
    throw asTypedError(err);
  }
  checkStop(response, adaptorId(adaptor));
  const parsed = adaptor.output.safeParse(response.parsed_output);
  if (!parsed.success) {
    throw new BusinessError(`the model’s answer did not match ${adaptorId(adaptor)}’s schema: ${parsed.error.message}`, 'AGENT_UNPARSEABLE', {
      adaptor: adaptorId(adaptor),
    });
  }
  return { output: parsed.data, model: response.model };
}

/**
 * The `api` transport behind the same {@link CoderRunner} the local transports
 * implement, so `coder:compile` can use it unchanged: the intent goes in, the
 * model's text comes out, and the DSL oracle decides as before (ADR-117,
 * Boundaries).
 */
export function makeApiRunner(transport: Extract<CoderTransport, { kind: 'api' }>, client?: MessagesClient): CoderRunner {
  return {
    async generate(request: IntentCompileRequest): Promise<string> {
      const api = client ?? anthropicClient();
      const system = request.systemPromptPath ? await readFile(request.systemPromptPath, 'utf8') : undefined;
      let response;
      try {
        response = await api.beta.messages.create({
          model: request.model ?? transport.model ?? DEFAULT_API_MODEL,
          max_tokens: MAX_TOKENS,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          ...(system ? { system: [{ type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } }] } : {}),
          messages: [{ role: 'user', content: request.intent }],
        });
      } catch (err) {
        throw asTypedError(err);
      }
      checkStop(response, request.adaptor ?? 'intent');
      return response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
    },
  };
}
