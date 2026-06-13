import { SseParser } from "./sse";
import { SYSTEM_PROMPT } from "./systemPrompt";

export interface StreamHandlers {
  /** Accumulated final + thought text so far (each still includes any <threads> tag). */
  onChunk: (final: string, thought: string) => void;
  /** Final + thought text plus timing metrics. */
  onDone: (final: string, thought: string, ttft: number, tokensPerSec: number) => void;
  /** Human-readable failure message. */
  onError: (message: string) => void;
}

/** Dialable persona traits (1–7), folded into the system prompt server-side. */
export type Traits = Record<string, number>;

export interface StreamCoderOptions extends StreamHandlers {
  url: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  /** Groups exchanges into one episode server-side; enables episode capture. */
  sessionId?: string;
  /** Persona dial (e.g. { sarcasm: 5 }); merged into the system prompt by coder serve. */
  traits?: Traits;
  signal?: AbortSignal;
}

export interface GenerateRequestBody {
  prompt: string;
  system: string;
  maxTokens: number;
  sessionId?: string;
  traits?: Traits;
}

/**
 * Build the `/generate` request body, including `sessionId`/`traits` only when
 * present (so single-shot requests stay unchanged). Pure — unit-testable.
 */
export function buildGenerateBody(opts: {
  prompt: string;
  system: string;
  maxTokens: number;
  sessionId?: string;
  traits?: Traits;
}): GenerateRequestBody {
  const body: GenerateRequestBody = {
    prompt: opts.prompt,
    system: opts.system,
    maxTokens: opts.maxTokens,
  };
  if (opts.sessionId) body.sessionId = opts.sessionId;
  if (opts.traits && Object.keys(opts.traits).length > 0) body.traits = opts.traits;
  return body;
}

/**
 * Persist the accumulated session as an episode (coder serve `POST /episodes/save`).
 * Total — never throws; returns whether the save succeeded (404 = nothing recorded).
 */
export async function saveEpisode(url: string, sessionId: string, signal?: AbortSignal): Promise<boolean> {
  const endpoint = `${url.replace(/\/$/, "")}/episodes/save`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function corsHelp(url: string): string {
  return (
    `[inner-voice] Cannot reach coder serve at ${url}. Start it with:\n` +
    `  coder serve                 (uses default_model from ~/.coder/config.toml)\n` +
    `  CODER_DRY_RUN=1 coder serve  (for testing without a model)`
  );
}

/**
 * Stream a generation from a local `coder serve` SSE endpoint. Resolves when
 * the stream ends. All failures (network, CORS, HTTP, abort) are reported via
 * `onError` rather than thrown, so the UI can degrade gracefully.
 */
export async function streamCoder(opts: StreamCoderOptions): Promise<void> {
  const { url, prompt, system = SYSTEM_PROMPT, maxTokens = 512, sessionId, traits, signal } = opts;
  const endpoint = `${url.replace(/\/$/, "")}/generate`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGenerateBody({ prompt, system, maxTokens, sessionId, traits })),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    // eslint-disable-next-line no-console
    console.warn(corsHelp(url));
    opts.onError(err instanceof Error ? err.message : "network error");
    return;
  }

  if (!response.ok || !response.body) {
    opts.onError(`coder serve returned HTTP ${String(response.status)}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let final = "";
  let thought = "";
  let ttft = 0;
  let tokensPerSec = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (event.type === "token") {
          if (event.channel === "thought") thought += event.text;
          else final += event.text;
          opts.onChunk(final, thought);
        } else if (event.type === "done") {
          ttft = event.ttft;
          tokensPerSec = event.tokensPerSec;
        } else if (event.type === "error") {
          opts.onError(event.message);
          return;
        }
      }
    }
    opts.onDone(final, thought, ttft, tokensPerSec);
  } catch (err) {
    if (signal?.aborted) return;
    opts.onError(err instanceof Error ? err.message : "stream error");
  }
}
