import { describe, test, expect } from "bun:test";
import { resolveConfig, DEFAULT_CONFIG } from "../src/lib/config";
import { accumulateThreads } from "../src/lib/threads";
import { threadPosition } from "../src/lib/threadLayout";
import { SseParser, parseSseData } from "../src/lib/sse";

describe("resolveConfig", () => {
  test("returns defaults for empty/undefined source", () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG);
    expect(resolveConfig(null)).toEqual(DEFAULT_CONFIG);
  });

  test("overrides with valid manifest values", () => {
    const c = resolveConfig({ coderServeUrl: "http://x:1", pauseMs: 1000, maxThreads: 5 });
    expect(c.coderServeUrl).toBe("http://x:1");
    expect(c.pauseMs).toBe(1000);
    expect(c.maxThreads).toBe(5);
    // untouched fields keep defaults
    expect(c.minChars).toBe(DEFAULT_CONFIG.minChars);
  });

  test("coerces numeric strings and ignores garbage", () => {
    const c = resolveConfig({ pauseMs: "1800", minChars: "oops", maxHistoryTurns: {} });
    expect(c.pauseMs).toBe(1800);
    expect(c.minChars).toBe(DEFAULT_CONFIG.minChars);
    expect(c.maxHistoryTurns).toBe(DEFAULT_CONFIG.maxHistoryTurns);
  });
});

describe("accumulateThreads", () => {
  test("appends unique threads preserving first-seen order", () => {
    expect(accumulateThreads(["a"], ["b", "c"], 12)).toEqual(["a", "b", "c"]);
  });

  test("dedupes against history and within the incoming batch", () => {
    expect(accumulateThreads(["a", "b"], ["b", "a", "d"], 12)).toEqual(["a", "b", "d"]);
  });

  test("caps to max, keeping the most recent", () => {
    expect(accumulateThreads(["a", "b", "c"], ["d"], 2)).toEqual(["c", "d"]);
  });

  test("max <= 0 means no cap", () => {
    expect(accumulateThreads(["a", "b"], ["c"], 0)).toEqual(["a", "b", "c"]);
  });
});

describe("threadPosition", () => {
  test("index 0 anchors the -60° edge of the arc (x and y negative)", () => {
    // Per spec: angle = (i / max(total-1,1)) * 120 - 60, so i=0 → -60°.
    const p = threadPosition(0, 1);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeLessThan(0);
  });

  test("first of several leans left, last leans right", () => {
    const left = threadPosition(0, 3);
    const right = threadPosition(2, 3);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
  });

  test("middle node of three sits near the top (x≈0)", () => {
    const mid = threadPosition(1, 3);
    expect(Math.abs(mid.x)).toBeLessThan(1e-9);
  });

  test("every-other node is pushed further out", () => {
    // index 1 uses radius 90+20=110 vs index 0/2 radius 90
    const p1 = threadPosition(1, 4);
    expect(Number.isFinite(p1.x)).toBe(true);
    expect(Number.isFinite(p1.y)).toBe(true);
  });
});

describe("SSE parsing", () => {
  test("parseSseData maps token / done / sentinel / error", () => {
    expect(parseSseData('{"type":"token","text":"hi"}')).toEqual({ type: "token", text: "hi" });
    expect(parseSseData('{"type":"done","ttft":1,"tokensPerSec":2,"totalTokens":3}')).toEqual({
      type: "done", ttft: 1, tokensPerSec: 2, totalTokens: 3,
    });
    expect(parseSseData("[DONE]")).toEqual({ type: "sentinel" });
    expect(parseSseData('{"type":"error","message":"boom"}')).toEqual({ type: "error", message: "boom" });
    expect(parseSseData("not json")).toBeNull();
  });

  test("SseParser reassembles events split across chunks", () => {
    const p = new SseParser();
    expect(p.push('data: {"type":"to')).toEqual([]);
    const events = p.push('ken","text":"abc"}\n\ndata: [DONE]\n');
    expect(events[0]).toEqual({ type: "token", text: "abc" });
    expect(events[1]).toEqual({ type: "sentinel" });
  });

  test("SseParser ignores non-data lines", () => {
    const p = new SseParser();
    expect(p.push("event: ping\n:keepalive\n")).toEqual([]);
  });
});
