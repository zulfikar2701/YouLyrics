import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSettings, setSettings } from "../src/shared/settings";
import { DEFAULT_SETTINGS } from "../src/shared/types";

const store = new Map<string, unknown>();
beforeEach(() => {
  store.clear();
  // @ts-expect-error - mock chrome.storage
  globalThis.chrome = {
    storage: {
      sync: {
        get: vi.fn((keys: string[]) => {
          const out: Record<string, unknown> = {};
          for (const k of keys) if (store.has(k)) out[k] = store.get(k);
          return Promise.resolve(out);
        }),
        set: vi.fn((obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) store.set(k, v);
          return Promise.resolve();
        }),
      },
    },
  };
});

describe("settings", () => {
  it("returns defaults when nothing stored", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });
  it("merges stored partial over defaults", async () => {
    store.set("settings", { fontSize: 30 });
    const s = await getSettings();
    expect(s.fontSize).toBe(30);
    expect(s.position).toBe(DEFAULT_SETTINGS.position);
  });
  it("setSettings persists merged values", async () => {
    await setSettings({ fontSize: 28 });
    expect(store.get("settings")).toMatchObject({ fontSize: 28 });
  });
});
