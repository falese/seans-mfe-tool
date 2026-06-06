/**
 * Session-wide thread accumulation. Threads surfaced across turns are kept
 * unique (first-seen order) and capped to `max`, retaining the most recent.
 */
export function accumulateThreads(
  history: readonly string[],
  incoming: readonly string[],
  max: number,
): string[] {
  const seen = new Set(history);
  const merged = [...history];
  for (const thread of incoming) {
    if (!seen.has(thread)) {
      seen.add(thread);
      merged.push(thread);
    }
  }
  return max > 0 && merged.length > max ? merged.slice(merged.length - max) : merged;
}
