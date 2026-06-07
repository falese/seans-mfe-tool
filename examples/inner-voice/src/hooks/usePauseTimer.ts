import { useEffect, useRef, useState } from "react";

export interface UsePauseTimerArgs {
  text: string;
  pauseMs: number;
  minChars: number;
  /** False while a stream is in progress — the timer never fires then. */
  enabled: boolean;
  onFire: () => void;
}

export interface UsePauseTimerResult {
  /** True while a countdown is scheduled — drives the pulse glow. */
  active: boolean;
  /** Increments on each keystroke; use as the countdown bar's React key to restart its animation. */
  restartKey: number;
}

/**
 * Debounced "silence" trigger. Each change to `text` (re)starts a single timer;
 * after `pauseMs` of no further changes — and only if `text` has at least
 * `minChars` and a stream isn't running — `onFire` is called. Toggling `enabled`
 * does NOT restart the timer, so a finished stream never auto-refires; the next
 * keystroke does.
 */
export function usePauseTimer({
  text,
  pauseMs,
  minChars,
  enabled,
  onFire,
}: UsePauseTimerArgs): UsePauseTimerResult {
  const [restartKey, setRestartKey] = useState(0);
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  const onFireRef = useRef(onFire);
  enabledRef.current = enabled;
  onFireRef.current = onFire;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < minChars || !enabledRef.current) {
      setActive(false);
      return;
    }
    setActive(true);
    setRestartKey((k) => k + 1);
    timer.current = setTimeout(() => {
      setActive(false);
      if (enabledRef.current) onFireRef.current();
    }, pauseMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // enabled is intentionally read via ref, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, pauseMs, minChars]);

  return { active, restartKey };
}
