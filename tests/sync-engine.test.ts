import { describe, it, expect, vi } from "vitest";
import { findLineIndex, SyncEngine } from "../src/content/sync-engine";
import type { LrcLine } from "../src/shared/types";

const lines: LrcLine[] = [
  { time: 1, text: "a" },
  { time: 5, text: "b" },
  { time: 10, text: "c" },
  { time: 15, text: "d" },
];

describe("findLineIndex (binary search)", () => {
  it("returns -1 before first line", () => {
    expect(findLineIndex(lines, 0)).toBe(-1);
  });
  it("returns 0 at first line time", () => {
    expect(findLineIndex(lines, 1)).toBe(0);
  });
  it("returns correct index between lines", () => {
    expect(findLineIndex(lines, 7)).toBe(1);
    expect(findLineIndex(lines, 12)).toBe(2);
  });
  it("returns last index past the last line", () => {
    expect(findLineIndex(lines, 100)).toBe(3);
  });
});

function makeFakeVideo(getCurrent: () => number) {
  return {
    get currentTime() { return getCurrent(); },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    paused: false,
  } as unknown as HTMLVideoElement;
}

describe("SyncEngine", () => {
  it("calls onLineChange when crossing a line boundary", () => {
    const onLineChange = vi.fn();
    let currentTime = 0;
    const fakeVideo = makeFakeVideo(() => currentTime);
    const engine = new SyncEngine(fakeVideo, lines, onLineChange);
    engine.tick();
    currentTime = 1.0;
    engine.tick();
    currentTime = 5.5;
    engine.tick();
    currentTime = 7;
    engine.tick();
    expect(onLineChange).toHaveBeenCalledWith(-1);
    expect(onLineChange).toHaveBeenCalledWith(0);
    expect(onLineChange).toHaveBeenCalledWith(1);
    expect(onLineChange).toHaveBeenCalledTimes(3);
  });

  it("recalculates on seek", () => {
    const onLineChange = vi.fn();
    let currentTime = 0;
    const fakeVideo = makeFakeVideo(() => currentTime);
    const engine = new SyncEngine(fakeVideo, lines, onLineChange);
    engine.tick();
    currentTime = 12;
    engine.handleSeek();
    expect(onLineChange).toHaveBeenLastCalledWith(2);
  });
});
