import { useCallback, useEffect, useRef, useState } from "react";
import { runStream } from "../lib/runStream";
import { stripThreads } from "../lib/parseThreads";

export interface StreamMetrics {
  ttft: number;
  tokensPerSec: number;
}

export interface UseCoderStreamArgs {
  coderServeUrl: string;
  maxTokens: number;
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
}

/**
 * Drives a single generation against the active backend (local `coder serve` or
 * the Anthropic demo API — chosen inside runStream). Exposes live display text,
 * streaming state, timing metrics, and any error. Aborts in-flight requests on
 * a new start, on reset, and on unmount.
 */
export function useCoderStream({ coderServeUrl, maxTokens, onComplete }: UseCoderStreamArgs): UseCoderStreamResult {
  const [display, setDisplay] = useState("");
  const [thinking, setThinking] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

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
    [coderServeUrl, maxTokens],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDisplay("");
    setThinking("");
    setError(null);
    setMetrics(null);
    setIsStreaming(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { display, thinking, isStreaming, error, metrics, start, reset };
}
