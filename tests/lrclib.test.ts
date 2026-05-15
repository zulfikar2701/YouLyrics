import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchLrclib } from "../src/content/lrclib";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

function ok(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
function notFound() {
  return { ok: false, status: 404, json: () => Promise.resolve({}) };
}

describe("fetchLrclib", () => {
  it("returns exact-match result when /api/get succeeds", async () => {
    fetchMock.mockResolvedValueOnce(ok({
      id: 1, trackName: "Get Lucky", artistName: "Daft Punk",
      duration: 369, syncedLyrics: "[00:01.00]hi", plainLyrics: "hi",
    }));
    const r = await fetchLrclib({ artist: "Daft Punk", song: "Get Lucky", durationSec: 369 });
    expect(r?.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to /api/search when get returns 404", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(ok([
        { id: 2, trackName: "Get Lucky", artistName: "Daft Punk",
          duration: 400, syncedLyrics: "x", plainLyrics: "x" },
        { id: 3, trackName: "Get Lucky", artistName: "Daft Punk",
          duration: 370, syncedLyrics: "y", plainLyrics: "y" },
      ]));
    const r = await fetchLrclib({ artist: "Daft Punk", song: "Get Lucky", durationSec: 369 });
    expect(r?.id).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when no search result is within ±2s", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(ok([
        { id: 4, trackName: "x", artistName: "y",
          duration: 100, syncedLyrics: null, plainLyrics: null },
      ]));
    const r = await fetchLrclib({ artist: "y", song: "x", durationSec: 369 });
    expect(r).toBeNull();
  });

  it("returns null when search returns empty", async () => {
    fetchMock.mockResolvedValueOnce(notFound()).mockResolvedValueOnce(ok([]));
    const r = await fetchLrclib({ artist: "x", song: "y", durationSec: 100 });
    expect(r).toBeNull();
  });

  it("URL-encodes artist and song", async () => {
    fetchMock.mockResolvedValueOnce(notFound()).mockResolvedValueOnce(ok([]));
    await fetchLrclib({ artist: "A & B", song: "C / D", durationSec: 100 });
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(encodeURIComponent("A & B"));
    expect(url).toContain(encodeURIComponent("C / D"));
  });
});
