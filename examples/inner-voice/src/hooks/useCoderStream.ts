import { useCallback, useEffect, useRef, useState } from "react";
import { runStream } from "../lib/runStream";
import { saveEpisode, type Traits } from "../lib/streamCoder";
import { stripThreads } from "../lib/parseThreads";

export interface StreamMetrics {
  ttft: number;
  tokensPerSec: number;
}

export interface UseCoderStreamArgs {
  coderServeUrl: string;
  maxTokens: number;
  systemPrompt: string;
  /** Episode grouping; when set, exchanges are recorded server-side under this id. */
  sessionId?: string;
  /** Persona dial sent with every generation. */
  traits?: Traits;
  /** Called with the full RAW final + thought text (threads tags intact) when a stream ends. */
  onComplete?: (final: string, thought: string, metrics: StreamMetrics) => void;
}

export interface UseCoderStreamResult {
  /** Live final answer (threads tag stripped), accumulates during the stream. */
  display: string;
  /** Live reasoning / "inner voice" of the model (empty for non-reasoning models). */
  thinking: string;
  isStreaming: boolean;
  error: string | null;
  metrics: StreamMetrics | null;
  start: (prompt: string) => void;
  reset: () => void;
  /** Persist the current session as an episode (coder serve). Resolves to success. */
  saveSession: () => Promise<boolean>;
}

/**
 * Drives a single generation against the active backend (local `coder serve` or
 * the Anthropic demo API — chosen inside runStream). Exposes live display text,
 * streaming state, timing metrics, and any error. Aborts in-flight requests on
 * a new start, on reset, and on unmount.
 */
export function useCoderStream({ coderServeUrl, maxTokens, systemPrompt, sessionId, traits, onComplete }: UseCoderStreamArgs): UseCoderStreamResult {
  const [display, setDisplay] = useState("");
  const [thinking, setThinking] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // Read session/traits from refs so `start` stays stable across renders (traits
  // is a fresh object each render; the pause-timer closure must not go stale).
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const traitsRef = useRef(traits);
  traitsRef.current = traits;

  const start = useCallback(
    (prompt: string) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setError(null);
      setDisplay("");
      setThinking("");
      setMetrics(null);
      setIsStreaming(true);

      void runStream({
        prompt,
        coderServeUrl,
        maxTokens,
        system: systemPrompt,
        sessionId: sessionIdRef.current,
        traits: traitsRef.current,
        signal: ac.signal,
        onChunk: (final, thought) => {
          setDisplay(stripThreads(final));
          setThinking(stripThreads(thought));
        },
        onDone: (final, thought, ttft, tokensPerSec) => {
          setDisplay(stripThreads(final));
          setThinking(stripThreads(thought));
          setMetrics({ ttft, tokensPerSec });
          setIsStreaming(false);
          onCompleteRef.current?.(final, thought, { ttft, tokensPerSec });
        },
        onError: (message) => {
          setIsStreaming(false);
          setError(message);
        },
      });
    },
    [coderServeUrl, maxTokens, systemPrompt],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDisplay("");
    setThinking("");
    setError(null);
    setMetrics(null);
    setIsStreaming(false);
  }, []);

  const saveSession = useCallback(async (): Promise<boolean> => {
    const id = sessionIdRef.current;
    if (!id) return false;
    return saveEpisode(coderServeUrl, id);
  }, [coderServeUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { display, thinking, isStreaming, error, metrics, start, reset, saveSession };
}
