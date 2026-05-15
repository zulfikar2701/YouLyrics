import { describe, it, expect } from "vitest";
import { parseLrc } from "../src/content/lrc-parser";

describe("parseLrc", () => {
  it("parses standard LRC lines", () => {
    const lrc = "[00:12.34]Hello world\n[00:16.78]Goodbye";
    expect(parseLrc(lrc)).toEqual([
      { time: 12.34, text: "Hello world" },
      { time: 16.78, text: "Goodbye" },
    ]);
  });

  it("handles space after timestamp", () => {
    expect(parseLrc("[01:00.00] Hello"))
      .toEqual([{ time: 60.0, text: "Hello" }]);
  });

  it("supports two-digit centiseconds and three-digit ms", () => {
    expect(parseLrc("[00:01.5]A\n[00:02.500]B"))
      .toEqual([{ time: 1.5, text: "A" }, { time: 2.5, text: "B" }]);
  });

  it("ignores metadata lines like [ar:Artist]", () => {
    const lrc = "[ar:X]\n[ti:Y]\n[00:01.00]Lyric";
    expect(parseLrc(lrc)).toEqual([{ time: 1.0, text: "Lyric" }]);
  });

  it("supports multiple timestamps for one line", () => {
    expect(parseLrc("[00:10.00][00:20.00]Repeated"))
      .toEqual([
        { time: 10.0, text: "Repeated" },
        { time: 20.0, text: "Repeated" },
      ]);
  });

  it("sorts by time ascending", () => {
    const lrc = "[00:20.00]B\n[00:10.00]A";
    expect(parseLrc(lrc)).toEqual([
      { time: 10.0, text: "A" },
      { time: 20.0, text: "B" },
    ]);
  });

  it("handles empty input", () => {
    expect(parseLrc("")).toEqual([]);
  });

  it("strips inline word timing tags <00:01.23>", () => {
    expect(parseLrc("[00:10.00]<00:10.50>Hello <00:11.00>world"))
      .toEqual([{ time: 10.0, text: "Hello world" }]);
  });

  it("ignores malformed lines", () => {
    const lrc = "garbage\n[badformat]\n[00:01.00]ok";
    expect(parseLrc(lrc)).toEqual([{ time: 1.0, text: "ok" }]);
  });
});
