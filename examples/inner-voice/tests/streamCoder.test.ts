import { describe, test, expect } from "bun:test";
import { buildGenerateBody, saveEpisode } from "../src/lib/streamCoder";

describe("buildGenerateBody", () => {
  test("includes only prompt/system/maxTokens by default", () => {
    expect(buildGenerateBody({ prompt: "p", system: "s", maxTokens: 100 })).toEqual({
      prompt: "p",
      system: "s",
      maxTokens: 100,
    });
  });

  test("includes sessionId and non-empty traits when provided", () => {
    expect(
      buildGenerateBody({ prompt: "p", system: "s", maxTokens: 100, sessionId: "s1", traits: { sarcasm: 5 } }),
    ).toEqual({ prompt: "p", system: "s", maxTokens: 100, sessionId: "s1", traits: { sarcasm: 5 } });
  });

  test("omits an empty traits object and an empty sessionId", () => {
    const b = buildGenerateBody({ prompt: "p", system: "s", maxTokens: 100, traits: {}, sessionId: "" });
    expect(b.traits).toBeUndefined();
    expect(b.sessionId).toBeUndefined();
  });
});

describe("saveEpisode", () => {
  test("POSTs the sessionId to /episodes/save and returns ok", async () => {
    const calls: { url: unknown; init: RequestInit }[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = ((url: unknown, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true } as Response);
    }) as typeof fetch;
    try {
      const ok = await saveEpisode("http://localhost:3991/", "s1");
      expect(ok).toBe(true);
      expect(calls[0].url).toBe("http://localhost:3991/episodes/save");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ sessionId: "s1" });
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("returns false on network failure (never throws)", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("down"))) as typeof fetch;
    try {
      expect(await saveEpisode("http://x", "s1")).toBe(false);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
