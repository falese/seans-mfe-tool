import { describe, test, expect } from "bun:test";
import { parseThreads, stripThreads } from "../src/lib/parseThreads";

describe("parseThreads", () => {
  test("extracts a thread array from a well-formed tag", () => {
    const raw = 'Some thought.\n<threads>{"threads":["a","b","c"]}</threads>';
    expect(parseThreads(raw)).toEqual(["a", "b", "c"]);
  });

  test("returns [] when no tag is present", () => {
    expect(parseThreads("just prose, no threads")).toEqual([]);
  });

  test("returns [] on malformed JSON inside the tag (never throws)", () => {
    expect(parseThreads("<threads>{not json}</threads>")).toEqual([]);
  });

  test("returns [] when threads is not an array", () => {
    expect(parseThreads('<threads>{"threads":"nope"}</threads>')).toEqual([]);
  });

  test("filters out non-string and empty entries, trims whitespace", () => {
    const raw = '<threads>{"threads":["  keep  ", "", 5, "ok"]}</threads>';
    expect(parseThreads(raw)).toEqual(["keep", "ok"]);
  });

  test("is case-insensitive on the tag", () => {
    expect(parseThreads('<THREADS>{"threads":["x"]}</THREADS>')).toEqual(["x"]);
  });
});

describe("stripThreads", () => {
  test("removes the threads block from display text", () => {
    const raw = 'The core idea.\n<threads>{"threads":["a"]}</threads>';
    expect(stripThreads(raw)).toBe("The core idea.");
  });

  test("leaves text without a tag unchanged", () => {
    expect(stripThreads("no tag here")).toBe("no tag here");
  });

  test("removes multiple tags if present", () => {
    const raw = 'a<threads>{}</threads>b<threads>{}</threads>';
    expect(stripThreads(raw)).toBe("ab");
  });
});
