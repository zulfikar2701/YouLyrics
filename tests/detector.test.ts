import { describe, it, expect } from "vitest";
import { shouldAutoFetch } from "../src/content/detector";

const base = {
  videoId: "abc",
  title: "Daft Punk - Get Lucky",
  channelName: "DaftPunkVEVO",
  durationSec: 369,
  isLive: false,
};

describe("shouldAutoFetch", () => {
  it("allows normal music videos", () => {
    expect(shouldAutoFetch(base, 900)).toBe(true);
  });

  it("blocks live streams", () => {
    expect(shouldAutoFetch({ ...base, isLive: true }, 900)).toBe(false);
  });

  it("blocks shorter than 30s", () => {
    expect(shouldAutoFetch({ ...base, durationSec: 25 }, 900)).toBe(false);
  });

  it("blocks longer than maxDuration", () => {
    expect(shouldAutoFetch({ ...base, durationSec: 1000 }, 900)).toBe(false);
  });

  it("blocks podcasts (title keyword)", () => {
    expect(shouldAutoFetch({
      ...base, title: "My Music Podcast Ep. 5", channelName: "Some Channel",
    }, 900)).toBe(false);
  });

  it("blocks tutorials", () => {
    expect(shouldAutoFetch({
      ...base, title: "Guitar Tutorial: Get Lucky", channelName: "Some Channel",
    }, 900)).toBe(false);
  });

  it("blocks gaming channels", () => {
    expect(shouldAutoFetch({
      ...base, title: "Some video", channelName: "Best Gaming Channel",
    }, 900)).toBe(false);
  });

  it("VEVO channel overrides soft non-music keywords", () => {
    expect(shouldAutoFetch({
      ...base, title: "The Review (Official Music Video)",
      channelName: "ArtistVEVO",
    }, 900)).toBe(true);
  });

  it("Topic channel overrides soft non-music keywords", () => {
    expect(shouldAutoFetch({
      ...base, title: "Reaction to Love",
      channelName: "Beyoncé - Topic",
    }, 900)).toBe(true);
  });

  it("'Official Music Video' overrides soft skip", () => {
    expect(shouldAutoFetch({
      ...base, title: "Documentary - The Song (Official Music Video)",
    }, 900)).toBe(true);
  });
});
