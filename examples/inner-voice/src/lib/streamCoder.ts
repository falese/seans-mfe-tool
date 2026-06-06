import { SseParser } from "./sse";
import { SYSTEM_PROMPT } from "./systemPrompt";

export interface StreamHandlers {
  /** Accumulated raw text so far (still includes any <threads> tag). */
  onChunk: (text: string) => void;
  /** Final raw text plus timing metrics. */
  onDone: (full: string, ttft: number, tokensPerSec: number) => void;
  /** Human-readable failure message. */
  onError: (message: string) => void;
}

export interface StreamCoderOptions extends StreamHandlers {
  url: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  signal?: AbortSignal;
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
  const { url, prompt, system = SYSTEM_PROMPT, maxTokens = 512, signal } = opts;
  const endpoint = `${url.replace(/\/$/, "")}/generate`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, system, maxTokens }),
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
  let accumulated = "";
  let ttft = 0;
  let tokensPerSec = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (event.type === "token") {
          accumulated += event.text;
          opts.onChunk(accumulated);
        } else if (event.type === "done") {
          ttft = event.ttft;
          tokensPerSec = event.tokensPerSec;
        } else if (event.type === "error") {
          opts.onError(event.message);
          return;
        }
      }
    }
    opts.onDone(accumulated, ttft, tokensPerSec);
  } catch (err) {
    if (signal?.aborted) return;
    opts.onError(err instanceof Error ? err.message : "stream error");
  }
}
