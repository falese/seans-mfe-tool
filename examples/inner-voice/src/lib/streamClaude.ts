import type { StreamHandlers } from "./streamCoder";
import { SYSTEM_PROMPT } from "./systemPrompt";

export interface StreamClaudeOptions extends StreamHandlers {
  apiKey: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  model?: string;
  signal?: AbortSignal;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Current low-latency model for an interactive thinking partner. The original
// product spec named claude-sonnet-4-20250514 (now deprecated); claude-sonnet-4-6
// is the current Sonnet. Override via VITE_ANTHROPIC_MODEL.
const DEFAULT_MODEL = "claude-sonnet-4-6";

interface AnthropicDelta {
  type?: string;
  text?: string;
}
interface AnthropicStreamEvent {
  type?: string;
  delta?: AnthropicDelta;
  usage?: { output_tokens?: number };
}

/**
 * Browser demo path: stream a generation directly from the Anthropic Messages
 * API (SSE). Used on GitHub Pages where `coder serve` isn't reachable. Requires
 * an API key injected at build time (VITE_ANTHROPIC_API_KEY) — demo only; never
 * ship a real key to production.
 *
 * Failures are reported via onError, never thrown.
 */
export async function streamClaude(opts: StreamClaudeOptions): Promise<void> {
  const { apiKey, prompt, system = SYSTEM_PROMPT, maxTokens = 1024, model = DEFAULT_MODEL, signal } = opts;

  if (!apiKey) {
    opts.onError(
      "Demo mode is missing an API key. Set VITE_ANTHROPIC_API_KEY at build time.",
    );
    return;
  }

  const start = Date.now();
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required to call the API directly from a browser (demo only).
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    opts.onError(err instanceof Error ? err.message : "network error");
    return;
  }

  if (!response.ok || !response.body) {
    opts.onError(`Anthropic API returned HTTP ${String(response.status)}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let ttft = 0;
  let outputTokens = 0;

  const handleEvent = (event: AnthropicStreamEvent): void => {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      if (ttft === 0) ttft = Date.now() - start;
      accumulated += event.delta.text ?? "";
      // Demo path has no reasoning channel — everything is the "final" voice.
      opts.onChunk(accumulated, "");
    } else if (event.type === "message_delta" && typeof event.usage?.output_tokens === "number") {
      outputTokens = event.usage.output_tokens;
    } else if (event.type === "error") {
      opts.onError("Anthropic API stream error");
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (line.startsWith("data:")) {
          const payload = line.slice("data:".length).trim();
          if (payload && payload !== "[DONE]") {
            try {
              handleEvent(JSON.parse(payload) as AnthropicStreamEvent);
            } catch {
              // ignore non-JSON keepalive lines
            }
          }
        }
        nl = buffer.indexOf("\n");
      }
    }
    const elapsedSec = (Date.now() - start) / 1000;
    const tokensPerSec = elapsedSec > 0 ? outputTokens / elapsedSec : 0;
    opts.onDone(accumulated, "", ttft, tokensPerSec);
  } catch (err) {
    if (signal?.aborted) return;
    opts.onError(err instanceof Error ? err.message : "stream error");
  }
}
