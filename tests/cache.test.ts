import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getLyrics, putLyrics, getNoLyrics, putNoLyrics,
  getOverride, putOverride, clearAll, makeKey,
} from "../src/content/cache";

const store = new Map<string, unknown>();
beforeEach(() => {
  store.clear();
  // @ts-expect-error - mock chrome.storage
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn((keys: string[]) => {
          const out: Record<string, unknown> = {};
          for (const k of keys) if (store.has(k)) out[k] = store.get(k);
          return Promise.resolve(out);
        }),
        set: vi.fn((obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) store.set(k, v);
          return Promise.resolve();
        }),
        clear: vi.fn(() => { store.clear(); return Promise.resolve(); }),
      },
    },
  };
});

describe("makeKey", () => {
  it("normalizes case and whitespace", () => {
    expect(makeKey("Daft Punk", "Get LUCKY")).toBe("daft punk|get lucky");
    expect(makeKey("  Adele  ", "  Hello  ")).toBe("adele|hello");
  });
});

describe("lyrics cache", () => {
  it("stores and retrieves a fresh record", async () => {
    const rec = {
      syncedLyrics: "[00:01.00]Hi", plainLyrics: null,
      source: "lrclib" as const, fetchedAt: Date.now(),
    };
    await putLyrics("Daft Punk", "Get Lucky", rec);
    const got = await getLyrics("Daft Punk", "Get Lucky");
    expect(got).toEqual(rec);
  });

  it("evicts records older than 30 days", async () => {
    const old = {
      syncedLyrics: null, plainLyrics: "x", source: "lrclib" as const,
      fetchedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    };
    store.set("lyrics:a|b", old);
    expect(await getLyrics("a", "b")).toBeNull();
  });
});

describe("nolyrics cache", () => {
  it("evicts records older than 7 days", async () => {
    const old = {
      source: "lrclib" as const,
      checkedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    };
    store.set("nolyrics:a|b", old);
    expect(await getNoLyrics("a", "b")).toBeNull();
  });

  it("returns recent records", async () => {
    await putNoLyrics("a", "b");
    expect(await getNoLyrics("a", "b")).not.toBeNull();
  });
});

describe("override cache", () => {
  it("stores forever (no TTL)", async () => {
    await putOverride("vid123", { artist: "x", title: "y", lrclibId: 9, setAt: 0 });
    const got = await getOverride("vid123");
    expect(got?.lrclibId).toBe(9);
  });
});

describe("clearAll", () => {
  it("removes everything", async () => {
    await putLyrics("a", "b", {
      syncedLyrics: "x", plainLyrics: null, source: "lrclib", fetchedAt: Date.now(),
    });
    await clearAll();
    expect(await getLyrics("a", "b")).toBeNull();
  });
});
