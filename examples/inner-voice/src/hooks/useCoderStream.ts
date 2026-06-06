import { useCallback, useEffect, useRef, useState } from "react";
import { runStream } from "../lib/runStream";
import { stripThreads } from "../lib/parseThreads";

export interface StreamMetrics {
  ttft: number;
  tokensPerSec: number;
}

export interface UseCoderStreamArgs {
  coderServeUrl: string;
  /** Called with the full RAW response (threads tag intact) when a stream ends. */
  onComplete?: (full: string, metrics: StreamMetrics) => void;
}

export interface UseCoderStreamResult {
  /** Live display text (threads tag stripped), accumulates during the stream. */
  display: string;
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
export function useCoderStream({ coderServeUrl, onComplete }: UseCoderStreamArgs): UseCoderStreamResult {
  const [display, setDisplay] = useState("");
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
      setMetrics(null);
      setIsStreaming(true);

      void runStream({
        prompt,
        coderServeUrl,
        signal: ac.signal,
        onChunk: (accumulated) => setDisplay(stripThreads(accumulated)),
        onDone: (full, ttft, tokensPerSec) => {
          setDisplay(stripThreads(full));
          setMetrics({ ttft, tokensPerSec });
          setIsStreaming(false);
          onCompleteRef.current?.(full, { ttft, tokensPerSec });
        },
        onError: (message) => {
          setIsStreaming(false);
          setError(message);
        },
      });
    },
    [coderServeUrl],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDisplay("");
    setError(null);
    setMetrics(null);
    setIsStreaming(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { display, isStreaming, error, metrics, start, reset };
}
