import { describe, it, expect } from "vitest";
import { normalizeTitle } from "../src/content/normalizer";

describe("normalizeTitle", () => {
  it("splits artist and song on dash", () => {
    expect(normalizeTitle("Daft Punk - Get Lucky", "DaftPunkVEVO"))
      .toEqual({ artist: "Daft Punk", song: "Get Lucky" });
  });

  it("strips (Official Music Video)", () => {
    expect(normalizeTitle("Daft Punk - Get Lucky (Official Music Video)", "x"))
      .toEqual({ artist: "Daft Punk", song: "Get Lucky" });
  });

  it("strips [HD] and [Official Audio]", () => {
    expect(normalizeTitle("Beyoncé - Halo [Official Audio] [HD]", "x"))
      .toEqual({ artist: "Beyoncé", song: "Halo" });
  });

  it("strips ft. and feat.", () => {
    expect(normalizeTitle("Ed Sheeran - Perfect ft. Beyoncé", "x"))
      .toEqual({ artist: "Ed Sheeran", song: "Perfect" });
    expect(normalizeTitle("Drake - One Dance feat. Wizkid & Kyla", "x"))
      .toEqual({ artist: "Drake", song: "One Dance" });
  });

  it("uses channel name as artist for Topic uploads", () => {
    expect(normalizeTitle("Halo", "Beyoncé - Topic"))
      .toEqual({ artist: "Beyoncé", song: "Halo" });
  });

  it("falls back to channel name when no dash", () => {
    expect(normalizeTitle("Halo", "Beyoncé"))
      .toEqual({ artist: "Beyoncé", song: "Halo" });
  });

  it("handles full-width brackets", () => {
    expect(normalizeTitle("【Music Video】AKMU - HEY KID", "x"))
      .toEqual({ artist: "AKMU", song: "HEY KID" });
  });

  it("handles song with colon (does not split)", () => {
    expect(normalizeTitle("Adele - Hello: A Performance", "x"))
      .toEqual({ artist: "Adele", song: "Hello: A Performance" });
  });

  it("strips Visualizer and Remastered noise", () => {
    expect(normalizeTitle("Queen - Bohemian Rhapsody (Remastered 2011)", "x"))
      .toEqual({ artist: "Queen", song: "Bohemian Rhapsody" });
  });

  it("collapses extra whitespace", () => {
    expect(normalizeTitle("Daft Punk   -    Get Lucky", "x"))
      .toEqual({ artist: "Daft Punk", song: "Get Lucky" });
  });

  it("handles only one dash even if multiple in song name", () => {
    expect(normalizeTitle("Artist X - Da-Da-Dance", "x"))
      .toEqual({ artist: "Artist X", song: "Da-Da-Dance" });
  });

  it("handles VEVO suffix in title", () => {
    expect(normalizeTitle("Taylor Swift - Lover VEVO", "x"))
      .toEqual({ artist: "Taylor Swift", song: "Lover" });
  });
});
