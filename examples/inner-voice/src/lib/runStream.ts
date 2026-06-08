import type { StreamHandlers, Traits } from "./streamCoder";
import { streamCoder } from "./streamCoder";
import { streamClaude } from "./streamClaude";
import { isDemoMode, anthropicApiKey, anthropicModel } from "./env";

export interface RunStreamOptions extends StreamHandlers {
  prompt: string;
  coderServeUrl: string;
  maxTokens?: number;
  system?: string;
  /** Episode grouping (coder serve only; ignored in demo/Claude mode). */
  sessionId?: string;
  /** Persona dial (coder serve only; ignored in demo/Claude mode). */
  traits?: Traits;
  signal?: AbortSignal;
}

/**
 * Single entry point the UI calls to start a generation. Routes to the Anthropic
 * API in demo mode (GitHub Pages, no local server) or to a local `coder serve`
 * SSE endpoint otherwise. Backend choice is invisible to the caller.
 */
export function runStream(opts: RunStreamOptions): Promise<void> {
  const handlers: StreamHandlers = {
    onChunk: opts.onChunk,
    onDone: opts.onDone,
    onError: opts.onError,
  };

  if (isDemoMode()) {
    return streamClaude({
      ...handlers,
      apiKey: anthropicApiKey(),
      model: anthropicModel(),
      prompt: opts.prompt,
      maxTokens: opts.maxTokens,
      system: opts.system,
      signal: opts.signal,
    });
  }

  return streamCoder({
    ...handlers,
    url: opts.coderServeUrl,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens,
    system: opts.system,
    sessionId: opts.sessionId,
    traits: opts.traits,
    signal: opts.signal,
  });
}
