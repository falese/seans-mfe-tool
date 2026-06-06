import { useCallback, useState } from "react";
import { accumulateThreads } from "../lib/threads";

export interface UseThreadsResult {
  /** Threads from the most recent response (the radial nodes). */
  current: string[];
  /** All unique threads across the session, capped to maxThreads. */
  history: string[];
  setFromResponse: (threads: string[]) => void;
  clearCurrent: () => void;
}

/**
 * Thread state for a session: the current radial set plus an accumulating,
 * deduped history. Escape clears `current` but leaves `history` intact.
 */
export function useThreads(maxThreads: number): UseThreadsResult {
  const [current, setCurrent] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  const setFromResponse = useCallback(
    (threads: string[]) => {
      setCurrent(threads);
      setHistory((h) => accumulateThreads(h, threads, maxThreads));
    },
    [maxThreads],
  );

  const clearCurrent = useCallback(() => setCurrent([]), []);

  return { current, history, setFromResponse, clearCurrent };
}
