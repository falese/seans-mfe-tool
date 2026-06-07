/**
 * Minimal incremental SSE parser for the `coder serve` /generate stream.
 *
 * The server emits one JSON object per `data:` line:
 *   data: {"type":"token","text":"..."}
 *   data: {"type":"done","ttft":142,"tokensPerSec":23.1,"totalTokens":87}
 *   data: [DONE]
 *   data: {"type":"error","message":"..."}
 *
 * `SseParser.push` is fed raw decoded chunks (which may split mid-line) and
 * returns whatever complete events it could parse. It never throws; malformed
 * payloads are dropped.
 */
export type Channel = "thought" | "final";

export type CoderEvent =
  | { type: "token"; channel: Channel; text: string }
  | { type: "done"; ttft: number; tokensPerSec: number; totalTokens: number }
  | { type: "error"; message: string }
  | { type: "sentinel" };

export function parseSseData(payload: string): CoderEvent | null {
  const data = payload.trim();
  if (data === "") return null;
  if (data === "[DONE]") return { type: "sentinel" };
  try {
    const obj = JSON.parse(data) as Record<string, unknown>;
    if (obj.type === "token" && typeof obj.text === "string") {
      // Older servers omit `channel`; default to "final" for back-compat.
      return { type: "token", channel: obj.channel === "thought" ? "thought" : "final", text: obj.text };
    }
    if (obj.type === "done") {
      return {
        type: "done",
        ttft: typeof obj.ttft === "number" ? obj.ttft : 0,
        tokensPerSec: typeof obj.tokensPerSec === "number" ? obj.tokensPerSec : 0,
        totalTokens: typeof obj.totalTokens === "number" ? obj.totalTokens : 0,
      };
    }
    if (obj.type === "error") {
      return {
        type: "error",
        message: typeof obj.message === "string" ? obj.message : "unknown error",
      };
    }
  } catch {
    // malformed JSON — drop
  }
  return null;
}

export class SseParser {
  private buffer = "";

  push(chunk: string): CoderEvent[] {
    this.buffer += chunk;
    const events: CoderEvent[] = [];
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      const trimmed = line.replace(/\r$/, "");
      if (trimmed.startsWith("data:")) {
        const event = parseSseData(trimmed.slice("data:".length));
        if (event) events.push(event);
      }
      newlineIndex = this.buffer.indexOf("\n");
    }
    return events;
  }
}
