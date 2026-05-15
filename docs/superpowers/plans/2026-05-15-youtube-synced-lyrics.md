# YouTube Synced Lyrics Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that auto-detects music videos on YouTube, fetches synced lyrics from LRCLIB, and renders a fullscreen-aware overlay synced to playback.

**Architecture:** Content script handles detection + rendering + sync; background worker handles CORS-blocked Genius scrape; popup hosts settings. Pure modules (normalizer, LRC parser, cache, LRCLIB client, detector) are unit-tested first; DOM-coupled modules use happy-dom integration tests.

**Tech Stack:** Vite + `@crxjs/vite-plugin`, TypeScript (strict), Preact (popup + dialog), Vitest + happy-dom, plain CSS modules, ESLint + Prettier.

**Spec:** `docs/superpowers/specs/2026-05-15-youtube-synced-lyrics-design.md`

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.eslintrc.cjs`, `.prettierrc`, `src/manifest.ts`, `src/content/index.ts` (stub), `src/background/index.ts` (stub), `src/popup/index.html`, `src/popup/main.tsx`

- [ ] **Step 1: Initialize npm project**

```bash
cd "D:/Side Project/LYRICS-YOUTUBE"
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm i preact
npm i -D vite @crxjs/vite-plugin typescript @types/chrome @preact/preset-vite \
  vitest happy-dom @vitest/ui \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  prettier eslint-config-prettier
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "types": ["chrome", "vite/client"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `src/manifest.ts`**

```ts
import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json";

export default defineManifest({
  manifest_version: 3,
  name: "YouTube Synced Lyrics",
  version: pkg.version,
  description: "Auto-fetched synced lyrics for YouTube music videos",
  icons: { 128: "icons/128.png" },
  action: { default_popup: "src/popup/index.html", default_icon: "icons/128.png" },
  background: { service_worker: "src/background/index.ts", type: "module" },
  content_scripts: [
    {
      matches: ["https://www.youtube.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage"],
  host_permissions: [
    "https://www.youtube.com/*",
    "https://lrclib.net/*",
    "https://genius.com/*",
  ],
});
```

- [ ] **Step 5: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import preact from "@preact/preset-vite";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: { rollupOptions: { input: { popup: "src/popup/index.html" } } },
  test: { environment: "happy-dom", globals: true, include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 6: Create stubs**

```ts
// src/content/index.ts
console.log("[ytlyrics] content script loaded");
```

```ts
// src/background/index.ts
console.log("[ytlyrics] background worker loaded");
```

```html
<!-- src/popup/index.html -->
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>YT Lyrics</title></head>
<body><div id="app"></div><script type="module" src="./main.tsx"></script></body></html>
```

```tsx
// src/popup/main.tsx
import { render } from "preact";
render(<div>Settings (placeholder)</div>, document.getElementById("app")!);
```

- [ ] **Step 7: Add npm scripts**

Modify `package.json` to include:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

Expected: build succeeds, `dist/` contains `manifest.json`, content script bundle, background script bundle, popup HTML.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with vite + crxjs + preact + vitest"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Create types file**

```ts
// src/shared/types.ts

export type LyricsRecord = {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: "lrclib" | "genius";
  lrclibId?: number;
  fetchedAt: number;
};

export type NoLyricsRecord = {
  source: "lrclib";
  checkedAt: number;
};

export type OverrideRecord = {
  artist: string;
  title: string;
  lrclibId: number;
  setAt: number;
};

export type UserSettings = {
  enabled: boolean;
  position: "top" | "middle" | "bottom";
  fontSize: number;
  maxDurationSec: number;
  showInFullscreen: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  position: "bottom",
  fontSize: 22,
  maxDurationSec: 900,
  showInFullscreen: true,
};

export type LrcLine = { time: number; text: string };

export type VideoMetadata = {
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  isLive: boolean;
};

export type ParsedSong = { artist: string; song: string };

export type LrclibResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  syncedLyrics: string | null;
  plainLyrics: string | null;
};

export type RuntimeMessage =
  | { type: "geniusSearch"; query: string }
  | { type: "geniusFetch"; url: string }
  | { type: "openManualSearch" };
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: shared type definitions"
```

---

## Task 3: Title normalizer

**Files:**
- Create: `src/content/normalizer.ts`, `tests/normalizer.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/normalizer.test.ts
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
    // first " - " is the split; "Da-Da-Dance" stays intact
    expect(normalizeTitle("Artist X - Da-Da-Dance", "x"))
      .toEqual({ artist: "Artist X", song: "Da-Da-Dance" });
  });

  it("handles VEVO suffix in title", () => {
    expect(normalizeTitle("Taylor Swift - Lover VEVO", "x"))
      .toEqual({ artist: "Taylor Swift", song: "Lover" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL — `normalizeTitle is not defined`

- [ ] **Step 3: Implement normalizer**

```ts
// src/content/normalizer.ts
import type { ParsedSong } from "../shared/types";

const BRACKET_PAIRS: [string, string][] = [
  ["(", ")"], ["[", "]"], ["【", "】"], ["《", "》"], ["「", "」"], ["『", "』"],
];

const NOISE_TOKENS = [
  "official music video", "official video", "official audio", "official lyric video",
  "music video", "lyric video", "lyrics video", "audio", "visualizer",
  "remastered", "remaster", "extended", "hd", "4k", "8k", "hq",
];

const FEAT_RE = /\b(?:feat\.?|ft\.?|featuring)\b.*$/i;
const VEVO_SUFFIX_RE = /\s+VEVO$/i;
const TOPIC_SUFFIX_RE = /\s+-\s+Topic$/i;

function stripBrackets(s: string): string {
  let out = s;
  for (const [open, close] of BRACKET_PAIRS) {
    const re = new RegExp(`\\${open}[^${open}${close}]*\\${close}`, "g");
    out = out.replace(re, " ");
  }
  return out;
}

function stripNoiseTokens(s: string): string {
  let out = s;
  for (const tok of NOISE_TOKENS) {
    out = out.replace(new RegExp(`\\b${tok}\\b`, "gi"), " ");
  }
  return out;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function normalizeTitle(rawTitle: string, channelName: string): ParsedSong {
  let t = rawTitle;
  t = stripBrackets(t);
  t = t.replace(VEVO_SUFFIX_RE, "");
  t = t.replace(FEAT_RE, "");
  t = stripNoiseTokens(t);
  t = clean(t);

  const dashIndex = t.indexOf(" - ");
  if (dashIndex >= 0) {
    const artist = clean(t.slice(0, dashIndex));
    const song = clean(t.slice(dashIndex + 3));
    if (artist && song) return { artist, song };
  }

  const topicMatch = channelName.match(TOPIC_SUFFIX_RE);
  if (topicMatch) {
    const artist = clean(channelName.replace(TOPIC_SUFFIX_RE, ""));
    return { artist, song: t };
  }

  return { artist: clean(channelName), song: t };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- normalizer
```
Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/normalizer.ts tests/normalizer.test.ts
git commit -m "feat: title normalizer with 12 unit tests"
```

---

## Task 4: LRC parser

**Files:**
- Create: `src/content/lrc-parser.ts`, `tests/lrc-parser.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lrc-parser.test.ts
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
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- lrc-parser
```
Expected: FAIL.

- [ ] **Step 3: Implement parser**

```ts
// src/content/lrc-parser.ts
import type { LrcLine } from "../shared/types";

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
const WORD_TAG_RE = /<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g;

export function parseLrc(text: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw) continue;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    TIMESTAMP_RE.lastIndex = 0;
    while ((m = TIMESTAMP_RE.exec(raw)) !== null) {
      const min = parseInt(m[1]!, 10);
      const sec = parseInt(m[2]!, 10);
      const fracStr = m[3] ?? "0";
      // Pad/truncate to milliseconds: "5" → 500ms, "50" → 500ms, "500" → 500ms
      const frac = parseFloat(`0.${fracStr}`);
      stamps.push(min * 60 + sec + frac);
    }
    if (stamps.length === 0) continue;
    const lastEnd = raw.lastIndexOf("]");
    const textPart = raw.slice(lastEnd + 1).replace(WORD_TAG_RE, "").trim();
    for (const t of stamps) {
      lines.push({ time: t, text: textPart });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- lrc-parser
```
Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/lrc-parser.ts tests/lrc-parser.test.ts
git commit -m "feat: LRC parser with 9 unit tests"
```

---

## Task 5: Cache module

**Files:**
- Create: `src/content/cache.ts`, `tests/cache.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/cache.test.ts
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
    const rec = { syncedLyrics: "[00:01.00]Hi", plainLyrics: null,
      source: "lrclib" as const, fetchedAt: Date.now() };
    await putLyrics("Daft Punk", "Get Lucky", rec);
    const got = await getLyrics("Daft Punk", "Get Lucky");
    expect(got).toEqual(rec);
  });

  it("evicts records older than 30 days", async () => {
    const old = { syncedLyrics: null, plainLyrics: "x", source: "lrclib" as const,
      fetchedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 };
    store.set("lyrics:a|b", old);
    expect(await getLyrics("a", "b")).toBeNull();
  });
});

describe("nolyrics cache", () => {
  it("evicts records older than 7 days", async () => {
    const old = { source: "lrclib" as const,
      checkedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 };
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
    await putLyrics("a", "b", { syncedLyrics: "x", plainLyrics: null, source: "lrclib", fetchedAt: Date.now() });
    await clearAll();
    expect(await getLyrics("a", "b")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- cache
```
Expected: FAIL.

- [ ] **Step 3: Implement cache**

```ts
// src/content/cache.ts
import type { LyricsRecord, NoLyricsRecord, OverrideRecord } from "../shared/types";

const LYRICS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NOLYRICS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function makeKey(artist: string, title: string): string {
  return `${artist.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

async function readOne<T>(key: string): Promise<T | null> {
  const obj = await chrome.storage.local.get([key]);
  return (obj[key] as T) ?? null;
}

export async function getLyrics(artist: string, title: string): Promise<LyricsRecord | null> {
  const key = `lyrics:${makeKey(artist, title)}`;
  const rec = await readOne<LyricsRecord>(key);
  if (!rec) return null;
  if (Date.now() - rec.fetchedAt > LYRICS_TTL_MS) return null;
  return rec;
}

export async function putLyrics(artist: string, title: string, rec: LyricsRecord): Promise<void> {
  const key = `lyrics:${makeKey(artist, title)}`;
  await chrome.storage.local.set({ [key]: rec });
}

export async function getNoLyrics(artist: string, title: string): Promise<NoLyricsRecord | null> {
  const key = `nolyrics:${makeKey(artist, title)}`;
  const rec = await readOne<NoLyricsRecord>(key);
  if (!rec) return null;
  if (Date.now() - rec.checkedAt > NOLYRICS_TTL_MS) return null;
  return rec;
}

export async function putNoLyrics(artist: string, title: string): Promise<void> {
  const key = `nolyrics:${makeKey(artist, title)}`;
  await chrome.storage.local.set({ [key]: { source: "lrclib", checkedAt: Date.now() } });
}

export async function getOverride(videoId: string): Promise<OverrideRecord | null> {
  return readOne<OverrideRecord>(`override:${videoId}`);
}

export async function putOverride(videoId: string, rec: OverrideRecord): Promise<void> {
  await chrome.storage.local.set({ [`override:${videoId}`]: rec });
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.clear();
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- cache
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/cache.ts tests/cache.test.ts
git commit -m "feat: chrome.storage.local cache with TTL"
```

---

## Task 6: LRCLIB client

**Files:**
- Create: `src/content/lrclib.ts`, `tests/lrclib.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lrclib.test.ts
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
    expect(r?.id).toBe(3); // closest duration
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
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- lrclib
```
Expected: FAIL.

- [ ] **Step 3: Implement client**

```ts
// src/content/lrclib.ts
import type { LrclibResult } from "../shared/types";

const BASE = "https://lrclib.net";

export type LrclibQuery = { artist: string; song: string; durationSec: number };

export async function fetchLrclib(q: LrclibQuery): Promise<LrclibResult | null> {
  const exactUrl = `${BASE}/api/get?artist_name=${encodeURIComponent(q.artist)}` +
    `&track_name=${encodeURIComponent(q.song)}&duration=${q.durationSec}`;
  const exact = await fetch(exactUrl);
  if (exact.ok) return await exact.json() as LrclibResult;

  const searchUrl = `${BASE}/api/search?q=${encodeURIComponent(`${q.artist} ${q.song}`)}`;
  const searchResp = await fetch(searchUrl);
  if (!searchResp.ok) return null;
  const results = await searchResp.json() as LrclibResult[];
  const candidates = results
    .filter(r => Math.abs(r.duration - q.durationSec) <= 2)
    .sort((a, b) => Math.abs(a.duration - q.durationSec) - Math.abs(b.duration - q.durationSec));
  return candidates[0] ?? null;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- lrclib
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/lrclib.ts tests/lrclib.test.ts
git commit -m "feat: LRCLIB client with exact-match + search fallback"
```

---

## Task 7: Detector & hard-skip rules

**Files:**
- Create: `src/content/detector.ts`, `tests/detector.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/detector.test.ts
import { describe, it, expect } from "vitest";
import { shouldAutoFetch } from "../src/content/detector";

const base = {
  videoId: "abc", title: "Daft Punk - Get Lucky",
  channelName: "DaftPunkVEVO", durationSec: 369, isLive: false,
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
    expect(shouldAutoFetch({ ...base, title: "My Music Podcast Ep. 5" }, 900)).toBe(false);
  });

  it("blocks tutorials", () => {
    expect(shouldAutoFetch({ ...base, title: "Guitar Tutorial: Get Lucky" }, 900)).toBe(false);
  });

  it("blocks gaming channels", () => {
    expect(shouldAutoFetch({ ...base, channelName: "Best Gaming Channel" }, 900)).toBe(false);
  });

  it("VEVO channel overrides soft non-music keywords", () => {
    // "review" in title would normally skip, but VEVO is a strong signal
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
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- detector
```
Expected: FAIL.

- [ ] **Step 3: Implement detector**

```ts
// src/content/detector.ts
import type { VideoMetadata } from "../shared/types";

const NON_MUSIC_TITLE_KEYWORDS = [
  "podcast", "interview", "vlog", "tutorial", "gameplay", "let's play",
  "walkthrough", "unboxing", "review", "reaction", "commentary", "highlights",
  "news", "livestream", "stream", "q&a", "ama", "episode", "ep.",
  "how to", "explained", "documentary",
];

const NON_MUSIC_CHANNEL_KEYWORDS = ["news", "gaming", "podcast", "tv"];

const STRONG_TITLE_SIGNALS = [
  "official video", "official music video", "official audio",
  "(audio)", "[mv]", "music video", "lyric video", "lyrics video",
];

function containsWord(haystack: string, needle: string): boolean {
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(haystack);
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some(n => containsWord(haystack, n));
}

function hasStrongMusicSignal(meta: VideoMetadata): boolean {
  const t = meta.title.toLowerCase();
  if (STRONG_TITLE_SIGNALS.some(s => t.includes(s))) return true;
  if (/vevo$/i.test(meta.channelName)) return true;
  if (/\s-\sTopic$/i.test(meta.channelName)) return true;
  return false;
}

export function shouldAutoFetch(meta: VideoMetadata, maxDurationSec: number): boolean {
  if (meta.isLive) return false;
  if (meta.durationSec < 30) return false;
  if (meta.durationSec > maxDurationSec) return false;

  const strong = hasStrongMusicSignal(meta);
  if (strong) return true;

  if (containsAny(meta.title, NON_MUSIC_TITLE_KEYWORDS)) return false;
  if (containsAny(meta.channelName, NON_MUSIC_CHANNEL_KEYWORDS)) return false;

  return true;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- detector
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/detector.ts tests/detector.test.ts
git commit -m "feat: video detector with hard-skip + strong-signal rules"
```

---

## Task 8: Settings storage

**Files:**
- Create: `src/shared/settings.ts`, `tests/settings.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/settings.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSettings, setSettings } from "../src/shared/settings";
import { DEFAULT_SETTINGS } from "../src/shared/types";

const store = new Map<string, unknown>();
beforeEach(() => {
  store.clear();
  // @ts-expect-error
  globalThis.chrome = {
    storage: { sync: {
      get: vi.fn((keys: string[]) => {
        const out: Record<string, unknown> = {};
        for (const k of keys) if (store.has(k)) out[k] = store.get(k);
        return Promise.resolve(out);
      }),
      set: vi.fn((obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) store.set(k, v);
        return Promise.resolve();
      }),
    } },
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
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- settings
```

- [ ] **Step 3: Implement**

```ts
// src/shared/settings.ts
import { DEFAULT_SETTINGS, type UserSettings } from "./types";

export async function getSettings(): Promise<UserSettings> {
  const raw = await chrome.storage.sync.get(["settings"]);
  return { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) };
}

export async function setSettings(patch: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.sync.set({ settings: { ...current, ...patch } });
}
```

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/shared/settings.ts tests/settings.test.ts
git commit -m "feat: settings storage with defaults + partial merge"
```

---

## Task 9: Sync engine

**Files:**
- Create: `src/content/sync-engine.ts`, `tests/sync-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/sync-engine.test.ts
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

describe("SyncEngine", () => {
  it("calls onLineChange when crossing a line boundary", () => {
    const onLineChange = vi.fn();
    let currentTime = 0;
    const fakeVideo = {
      get currentTime() { return currentTime; },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      paused: false,
    } as unknown as HTMLVideoElement;
    const engine = new SyncEngine(fakeVideo, lines, onLineChange);
    engine.tick(); // currentTime = 0 → idx -1
    currentTime = 1.0;
    engine.tick(); // crosses → idx 0
    currentTime = 5.5;
    engine.tick(); // crosses → idx 1
    currentTime = 7;
    engine.tick(); // no change → still 1
    expect(onLineChange).toHaveBeenCalledWith(-1);
    expect(onLineChange).toHaveBeenCalledWith(0);
    expect(onLineChange).toHaveBeenCalledWith(1);
    expect(onLineChange).toHaveBeenCalledTimes(3);
  });

  it("recalculates on seek", () => {
    const onLineChange = vi.fn();
    let currentTime = 0;
    const fakeVideo = {
      get currentTime() { return currentTime; },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      paused: false,
    } as unknown as HTMLVideoElement;
    const engine = new SyncEngine(fakeVideo, lines, onLineChange);
    engine.tick(); // -1
    currentTime = 12;
    engine.handleSeek();
    expect(onLineChange).toHaveBeenLastCalledWith(2);
  });
});
```

- [ ] **Step 2: Run to verify fail**

- [ ] **Step 3: Implement**

```ts
// src/content/sync-engine.ts
import type { LrcLine } from "../shared/types";

export function findLineIndex(lines: LrcLine[], time: number): number {
  // largest i where lines[i].time <= time, or -1 if none
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.time <= time) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

export type LineChangeCallback = (index: number) => void;

export class SyncEngine {
  private rafId: number | null = null;
  private currentIndex = -2; // -2 = uninitialized, force first emit

  constructor(
    private video: HTMLVideoElement,
    private lines: LrcLine[],
    private onLineChange: LineChangeCallback,
  ) {}

  start(): void {
    this.video.addEventListener("seeked", this.handleSeek);
    this.video.addEventListener("play", this.loop);
    this.video.addEventListener("pause", this.stop);
    if (!this.video.paused) this.loop();
    else this.tick();
  }

  stop = (): void => {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  };

  destroy(): void {
    this.stop();
    this.video.removeEventListener("seeked", this.handleSeek);
    this.video.removeEventListener("play", this.loop);
    this.video.removeEventListener("pause", this.stop);
  }

  setLines(lines: LrcLine[]): void {
    this.lines = lines;
    this.currentIndex = -2;
    this.tick();
  }

  loop = (): void => {
    this.tick();
    this.rafId = requestAnimationFrame(this.loop);
  };

  handleSeek = (): void => {
    this.currentIndex = -2;
    this.tick();
  };

  tick(): void {
    const idx = findLineIndex(this.lines, this.video.currentTime);
    if (idx !== this.currentIndex) {
      this.currentIndex = idx;
      this.onLineChange(idx);
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/content/sync-engine.ts tests/sync-engine.test.ts
git commit -m "feat: RAF sync engine with binary-search line lookup"
```

---

## Task 10: YouTube DOM watcher

**Files:**
- Create: `src/content/youtube-dom.ts`

This task is DOM-coupled and resists clean unit tests; we'll integration-test via the entry point in Task 16.

- [ ] **Step 1: Implement**

```ts
// src/content/youtube-dom.ts
import type { VideoMetadata } from "../shared/types";

export type NavigationCallback = () => void;

export function onYoutubeNavigation(cb: NavigationCallback): () => void {
  let lastUrl = location.href;
  let timer: number | null = null;

  const debounced = () => {
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(cb, 500);
  };

  const handler = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      debounced();
    }
  };

  window.addEventListener("yt-navigate-finish", debounced);
  window.addEventListener("popstate", handler);
  // Initial fire
  debounced();

  return () => {
    if (timer !== null) clearTimeout(timer);
    window.removeEventListener("yt-navigate-finish", debounced);
    window.removeEventListener("popstate", handler);
  };
}

export function getVideoIdFromUrl(): string | null {
  return new URL(location.href).searchParams.get("v");
}

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("video.html5-main-video");
}

export function getPlayerElement(): HTMLElement | null {
  return document.getElementById("movie_player");
}

async function waitForDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener("loadedmetadata", handler);
      resolve(video.duration);
    };
    video.addEventListener("loadedmetadata", handler);
  });
}

export async function extractMetadata(): Promise<VideoMetadata | null> {
  const videoId = getVideoIdFromUrl();
  if (!videoId) return null;
  const video = getVideoElement();
  if (!video) return null;

  const titleEl = document.querySelector<HTMLElement>(
    "h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string"
  );
  const channelEl = document.querySelector<HTMLElement>(
    "ytd-channel-name #text a, ytd-channel-name a"
  );
  const liveBadge = document.querySelector(".ytp-live-badge:not([style*='display: none'])");

  const title = titleEl?.textContent?.trim() ?? "";
  const channelName = channelEl?.textContent?.trim() ?? "";
  if (!title || !channelName) return null;

  const durationSec = Math.round(await waitForDuration(video));
  return {
    videoId, title, channelName, durationSec,
    isLive: liveBadge !== null,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/content/youtube-dom.ts
git commit -m "feat: YouTube DOM watcher (SPA nav + metadata extraction)"
```

---

## Task 11: Overlay element + CSS

**Files:**
- Create: `src/content/overlay/overlay.ts`, `src/content/overlay/overlay.css`

The overlay supports two modes: **synced** (3-line compact view, line index drives highlighting) and **static** (scrollable panel for Genius plain-text fallback, header indicates "Lyrics from Genius (not synced)").

- [ ] **Step 1: Implement CSS**

```css
/* src/content/overlay/overlay.css */
.ytlyrics-overlay {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 60;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 24px;
  background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%);
  color: #fff;
  text-align: center;
  font-family: "YouTube Sans", "Roboto", sans-serif;
  text-shadow: 0 2px 6px rgba(0,0,0,0.8);
  transition: opacity 0.2s ease;
}
.ytlyrics-overlay[data-position="bottom"] { bottom: 60px; }
.ytlyrics-overlay[data-position="middle"] { top: 50%; transform: translateY(-50%); }
.ytlyrics-overlay[data-position="top"] { top: 80px; }
.ytlyrics-overlay[data-mode="synced"] .ytlyrics-line {
  opacity: 0.55;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ytlyrics-overlay[data-mode="synced"] .ytlyrics-line.ytlyrics-active {
  opacity: 1;
  transform: scale(1.08);
  font-weight: 600;
}
.ytlyrics-overlay[data-mode="static"] .ytlyrics-static {
  max-height: 40vh;
  overflow-y: auto;
  white-space: pre-wrap;
  pointer-events: auto;
  padding: 8px 0;
  line-height: 1.45;
}
.ytlyrics-overlay[data-mode="static"] .ytlyrics-static-header {
  font-size: 11px;
  opacity: 0.7;
  margin-bottom: 6px;
}
.ytlyrics-overlay[data-hidden="true"] { opacity: 0; pointer-events: none; }
.ytlyrics-controls {
  pointer-events: auto;
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
}
.ytlyrics-controls a { color: #9cf; cursor: pointer; }
```

- [ ] **Step 2: Implement overlay manager**

```ts
// src/content/overlay/overlay.ts
import type { LrcLine, UserSettings } from "../../shared/types";
import "./overlay.css";

export type OverlayMode = "synced" | "static";

export class LyricsOverlay {
  private el: HTMLDivElement;
  private prevEl: HTMLDivElement;
  private activeEl: HTMLDivElement;
  private nextEl: HTMLDivElement;
  private staticEl: HTMLDivElement;
  private staticHeaderEl: HTMLDivElement;
  private controlsEl: HTMLDivElement;
  private lines: LrcLine[] = [];
  private mode: OverlayMode = "synced";

  constructor(parent: HTMLElement, settings: UserSettings, onWrongSong: () => void) {
    this.el = document.createElement("div");
    this.el.className = "ytlyrics-overlay";
    this.el.dataset.mode = "synced";
    this.el.dataset.position = settings.position;
    this.el.style.fontSize = `${settings.fontSize}px`;
    this.el.dataset.hidden = "false";

    this.staticHeaderEl = document.createElement("div");
    this.staticHeaderEl.className = "ytlyrics-static-header";
    this.staticHeaderEl.textContent = "Lyrics from Genius (not synced)";
    this.staticEl = document.createElement("div");
    this.staticEl.className = "ytlyrics-static";

    this.prevEl = document.createElement("div");
    this.prevEl.className = "ytlyrics-line ytlyrics-prev";
    this.activeEl = document.createElement("div");
    this.activeEl.className = "ytlyrics-line ytlyrics-active";
    this.nextEl = document.createElement("div");
    this.nextEl.className = "ytlyrics-line ytlyrics-next";

    this.controlsEl = document.createElement("div");
    this.controlsEl.className = "ytlyrics-controls";
    const wrong = document.createElement("a");
    wrong.textContent = "Wrong song?";
    wrong.addEventListener("click", onWrongSong);
    this.controlsEl.appendChild(wrong);

    this.el.append(
      this.staticHeaderEl, this.staticEl,
      this.prevEl, this.activeEl, this.nextEl,
      this.controlsEl,
    );
    this.applyModeVisibility();
    parent.appendChild(this.el);
  }

  setSyncedLines(lines: LrcLine[]): void {
    this.mode = "synced";
    this.el.dataset.mode = "synced";
    this.applyModeVisibility();
    this.lines = lines;
    this.render(-1);
  }

  setStaticText(text: string): void {
    this.mode = "static";
    this.el.dataset.mode = "static";
    this.applyModeVisibility();
    this.staticEl.textContent = text;
  }

  render(idx: number): void {
    if (this.mode !== "synced") return;
    this.prevEl.textContent = idx > 0 ? this.lines[idx - 1]?.text ?? "" : "";
    this.activeEl.textContent = idx >= 0 ? this.lines[idx]?.text ?? "" : "";
    this.nextEl.textContent = idx + 1 < this.lines.length ? this.lines[idx + 1]?.text ?? "" : "";
  }

  setHidden(hidden: boolean): void {
    this.el.dataset.hidden = String(hidden);
  }

  isHidden(): boolean {
    return this.el.dataset.hidden === "true";
  }

  applySettings(s: UserSettings): void {
    this.el.dataset.position = s.position;
    this.el.style.fontSize = `${s.fontSize}px`;
  }

  destroy(): void {
    this.el.remove();
  }

  private applyModeVisibility(): void {
    const synced = this.mode === "synced";
    this.prevEl.style.display = synced ? "" : "none";
    this.activeEl.style.display = synced ? "" : "none";
    this.nextEl.style.display = synced ? "" : "none";
    this.staticHeaderEl.style.display = synced ? "none" : "";
    this.staticEl.style.display = synced ? "none" : "";
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/content/overlay/overlay.ts src/content/overlay/overlay.css
git commit -m "feat: lyrics overlay element with compact/expanded modes"
```

---

## Task 12: Player button injection

**Files:**
- Create: `src/content/overlay/player-button.ts`

- [ ] **Step 1: Implement**

```ts
// src/content/overlay/player-button.ts
export type ButtonState = "loading" | "available" | "unavailable";

const ICON_SVG = `<svg height="100%" viewBox="0 0 24 24" width="100%"
  fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>`;

export class PlayerButton {
  private btn: HTMLButtonElement;
  private state: ButtonState = "unavailable";

  constructor(parent: HTMLElement, onClick: () => void, onContext: (e: MouseEvent) => void) {
    this.btn = document.createElement("button");
    this.btn.className = "ytp-button ytlyrics-button";
    this.btn.title = "Lyrics";
    this.btn.style.cssText = "width:48px;height:48px;padding:12px;";
    this.btn.innerHTML = ICON_SVG;
    this.btn.addEventListener("click", onClick);
    this.btn.addEventListener("contextmenu", (e) => { e.preventDefault(); onContext(e); });
    this.applyState();
    parent.prepend(this.btn);
  }

  setState(state: ButtonState): void {
    this.state = state;
    this.applyState();
  }

  private applyState(): void {
    this.btn.dataset.state = this.state;
    this.btn.style.opacity =
      this.state === "unavailable" ? "0.5" :
      this.state === "loading" ? "0.7" : "1";
  }

  destroy(): void {
    this.btn.remove();
  }
}
```

- [ ] **Step 2: Type-check**

- [ ] **Step 3: Commit**

```bash
git add src/content/overlay/player-button.ts
git commit -m "feat: player button with loading/available/unavailable states"
```

---

## Task 13: Manual search dialog (Preact)

**Files:**
- Create: `src/content/overlay/search-dialog.tsx`, `src/content/overlay/search-dialog.css`

- [ ] **Step 1: Implement CSS**

```css
/* src/content/overlay/search-dialog.css */
.ytlyrics-dialog-backdrop {
  position: absolute; inset: 0; z-index: 70;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
}
.ytlyrics-dialog {
  background: #1f1f1f; color: #fff; border-radius: 8px;
  padding: 20px; min-width: 360px; max-width: 80%;
  font-family: Roboto, sans-serif;
}
.ytlyrics-dialog input {
  width: 100%; padding: 8px; margin: 4px 0; border-radius: 4px;
  border: 1px solid #444; background: #111; color: #fff; box-sizing: border-box;
}
.ytlyrics-dialog button {
  padding: 8px 16px; background: #cc0000; color: #fff;
  border: 0; border-radius: 4px; cursor: pointer; margin-top: 8px;
}
.ytlyrics-dialog ul { list-style: none; padding: 0; max-height: 300px; overflow-y: auto; }
.ytlyrics-dialog li {
  padding: 8px; cursor: pointer; border-radius: 4px;
}
.ytlyrics-dialog li:hover { background: #333; }
.ytlyrics-dialog .meta { font-size: 12px; color: #aaa; }
.ytlyrics-dialog .badge {
  font-size: 10px; background: #2d6cdf; padding: 2px 6px; border-radius: 3px; margin-left: 6px;
}
```

- [ ] **Step 2: Implement dialog**

```tsx
// src/content/overlay/search-dialog.tsx
import { render, h } from "preact";
import { useState } from "preact/hooks";
import type { LrclibResult } from "../../shared/types";
import "./search-dialog.css";

type Props = {
  initialArtist: string;
  initialSong: string;
  onPick: (r: LrclibResult) => void;
  onClose: () => void;
};

function Dialog({ initialArtist, initialSong, onPick, onClose }: Props) {
  const [artist, setArtist] = useState(initialArtist);
  const [song, setSong] = useState(initialSong);
  const [results, setResults] = useState<LrclibResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${song}`)}`;
      const r = await fetch(url);
      setResults(r.ok ? await r.json() : []);
    } finally {
      setLoading(false);
    }
  }

  return h("div", { class: "ytlyrics-dialog-backdrop", onClick: (e: MouseEvent) =>
    (e.target as HTMLElement).classList.contains("ytlyrics-dialog-backdrop") && onClose() },
    h("div", { class: "ytlyrics-dialog" },
      h("h3", null, "Search lyrics"),
      h("input", { value: artist, placeholder: "Artist",
        onInput: (e: Event) => setArtist((e.target as HTMLInputElement).value) }),
      h("input", { value: song, placeholder: "Song",
        onInput: (e: Event) => setSong((e.target as HTMLInputElement).value) }),
      h("button", { onClick: search, disabled: loading },
        loading ? "Searching..." : "Search LRCLIB"),
      h("ul", null, results.map((r) =>
        h("li", { key: r.id, onClick: () => onPick(r) },
          h("div", null, r.trackName, " — ", r.artistName,
            r.syncedLyrics ? h("span", { class: "badge" }, "✓ synced") : null),
          h("div", { class: "meta" }, r.albumName ?? "", " · ", `${r.duration}s`),
        ),
      )),
    ),
  );
}

export function openSearchDialog(parent: HTMLElement, props: Props): () => void {
  const root = document.createElement("div");
  parent.appendChild(root);
  render(h(Dialog, { ...props, onClose: () => { props.onClose(); cleanup(); } }), root);
  function cleanup() { render(null, root); root.remove(); }
  return cleanup;
}
```

- [ ] **Step 3: Type-check**

- [ ] **Step 4: Commit**

```bash
git add src/content/overlay/search-dialog.tsx src/content/overlay/search-dialog.css
git commit -m "feat: manual search dialog (Preact, fullscreen-aware)"
```

---

## Task 14: Background worker (Genius scrape)

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Implement message handler**

```ts
// src/background/index.ts
import type { RuntimeMessage } from "../shared/types";

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === "geniusSearch") {
    geniusSearch(msg.query).then(sendResponse).catch(() => sendResponse(null));
    return true; // async
  }
  if (msg.type === "geniusFetch") {
    geniusFetchLyrics(msg.url).then(sendResponse).catch(() => sendResponse(null));
    return true;
  }
  return false;
});

async function geniusSearch(query: string): Promise<{ url: string; title: string } | null> {
  const r = await fetch(`https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`);
  if (!r.ok) return null;
  const json = await r.json();
  const sections = json?.response?.sections ?? [];
  for (const s of sections) {
    if (s.type === "song") {
      const hit = s.hits?.[0]?.result;
      if (hit) return { url: hit.url as string, title: hit.full_title as string };
    }
  }
  return null;
}

async function geniusFetchLyrics(url: string): Promise<string | null> {
  // NOTE: Genius DOM convention as of 2026-05. Update parser if Genius changes layout.
  const r = await fetch(url);
  if (!r.ok) return null;
  const html = await r.text();
  const matches = html.matchAll(
    /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g
  );
  let text = "";
  for (const m of matches) {
    const inner = m[1] ?? "";
    text += inner
      .replace(/<br\s*\/?>(\s*)/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
    text += "\n";
  }
  return text.trim() || null;
}
```

- [ ] **Step 2: Type-check**

- [ ] **Step 3: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: background worker for Genius search and lyrics scrape"
```

---

## Task 15: Popup UI

**Files:**
- Replace: `src/popup/main.tsx`
- Create: `src/popup/App.tsx`, `src/popup/popup.css`

- [ ] **Step 1: Implement App**

```tsx
// src/popup/App.tsx
import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getSettings, setSettings } from "../shared/settings";
import { DEFAULT_SETTINGS, type UserSettings } from "../shared/types";
import "./popup.css";

export function App() {
  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => { void getSettings().then(setS); }, []);

  function update(patch: Partial<UserSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    void setSettings(patch);
  }

  return h("div", { class: "popup" },
    h("h2", null, "YT Synced Lyrics"),
    h("label", null,
      h("input", {
        type: "checkbox", checked: s.enabled,
        onChange: (e: Event) => update({ enabled: (e.target as HTMLInputElement).checked }),
      }),
      " Enabled",
    ),
    h("label", null, "Position",
      h("select", {
        value: s.position,
        onChange: (e: Event) =>
          update({ position: (e.target as HTMLSelectElement).value as UserSettings["position"] }),
      },
        h("option", { value: "top" }, "Top"),
        h("option", { value: "middle" }, "Middle"),
        h("option", { value: "bottom" }, "Bottom"),
      ),
    ),
    h("label", null, `Font size: ${s.fontSize}px`,
      h("input", {
        type: "range", min: 14, max: 40, value: s.fontSize,
        onInput: (e: Event) => update({ fontSize: parseInt((e.target as HTMLInputElement).value, 10) }),
      }),
    ),
    h("label", null, `Max video duration: ${Math.round(s.maxDurationSec / 60)} min`,
      h("input", {
        type: "range", min: 60, max: 3600, step: 60, value: s.maxDurationSec,
        onInput: (e: Event) => update({ maxDurationSec: parseInt((e.target as HTMLInputElement).value, 10) }),
      }),
    ),
    h("label", null,
      h("input", {
        type: "checkbox", checked: s.showInFullscreen,
        onChange: (e: Event) =>
          update({ showInFullscreen: (e.target as HTMLInputElement).checked }),
      }),
      " Show in fullscreen",
    ),
    h("button", {
      onClick: async () => {
        await chrome.storage.local.clear();
        alert("Cache cleared");
      },
    }, "Clear cache"),
    h("button", {
      onClick: async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "openManualSearch" });
        window.close();
      },
    }, "Open manual search"),
  );
}
```

- [ ] **Step 2: Implement popup CSS**

```css
/* src/popup/popup.css */
body { margin: 0; }
.popup {
  width: 280px; padding: 16px;
  font-family: Roboto, sans-serif; background: #202020; color: #eee;
}
.popup h2 { margin: 0 0 12px; font-size: 16px; }
.popup label {
  display: block; margin: 10px 0; font-size: 13px;
}
.popup input[type="range"] { width: 100%; }
.popup select { margin-left: 8px; }
.popup button {
  display: block; width: 100%; margin-top: 8px;
  padding: 8px; background: #cc0000; color: #fff; border: 0; border-radius: 4px; cursor: pointer;
}
.popup button:last-child { background: #444; }
```

- [ ] **Step 3: Update main**

```tsx
// src/popup/main.tsx
import { render, h } from "preact";
import { App } from "./App";
render(h(App, null), document.getElementById("app")!);
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/popup/
git commit -m "feat: popup settings UI"
```

---

## Task 16: Content script entry — wire it all together

**Files:**
- Replace: `src/content/index.ts`

The orchestrator:
1. Always injects the player button on every YouTube watch page (even hard-skipped ones), so users can override the filter.
2. If hard-skip rules pass and no override exists, runs the auto-fetch pipeline: LRCLIB → if no synced lyrics, fall back to Genius automatically.
3. If hard-skip rules fail, button is "unavailable, never fetched"; clicking it triggers a forced fetch as if the video were music.
4. If both LRCLIB and Genius return nothing, button becomes "unavailable, already fetched"; clicking opens the manual search dialog.

- [ ] **Step 1: Implement orchestrator**

```ts
// src/content/index.ts
import { onYoutubeNavigation, extractMetadata, getPlayerElement, getVideoElement } from "./youtube-dom";
import { normalizeTitle } from "./normalizer";
import { shouldAutoFetch } from "./detector";
import { getLyrics, putLyrics, getNoLyrics, putNoLyrics, getOverride, putOverride } from "./cache";
import { fetchLrclib } from "./lrclib";
import { parseLrc } from "./lrc-parser";
import { SyncEngine } from "./sync-engine";
import { LyricsOverlay } from "./overlay/overlay";
import { PlayerButton } from "./overlay/player-button";
import { openSearchDialog } from "./overlay/search-dialog";
import { getSettings } from "../shared/settings";
import type { LrclibResult, LyricsRecord, ParsedSong, RuntimeMessage, VideoMetadata } from "../shared/types";

type FetchOutcome = "never-fetched" | "fetched-empty";

type SessionState = {
  meta: VideoMetadata;
  parsed: ParsedSong;
  overlay: LyricsOverlay | null;
  button: PlayerButton;
  engine: SyncEngine | null;
  outcome: FetchOutcome;
  cleanupDialog?: () => void;
};
let session: SessionState | null = null;

async function run() {
  teardown();

  const meta = await extractMetadata();
  if (!meta) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const player = getPlayerElement();
  const video = getVideoElement();
  if (!player || !video) return;

  const parsed = normalizeTitle(meta.title, meta.channelName);

  // Always inject the button — even on hard-skipped videos
  const rightControls = player.querySelector<HTMLElement>(".ytp-right-controls");
  if (!rightControls) return;
  const button = new PlayerButton(
    rightControls,
    () => onButtonClick(),
    () => onButtonClick(),
  );

  session = { meta, parsed, overlay: null, button, engine: null, outcome: "never-fetched" };

  // Determine if we auto-fetch
  const override = await getOverride(meta.videoId);
  const allowAuto = override !== null || shouldAutoFetch(meta, settings.maxDurationSec);

  if (!allowAuto) {
    // Hard-skip filter blocked us. Button stays clickable for manual override.
    button.setState("unavailable");
    return;
  }

  await runFetchPipeline({ artist: parsed.artist, song: parsed.song, override });
}

async function runFetchPipeline(args: { artist: string; song: string; override: { artist: string; title: string } | null }) {
  if (!session) return;
  const { meta, parsed } = session;
  session.button.setState("loading");

  const fetchArtist = args.override?.artist ?? args.artist;
  const fetchSong = args.override?.title ?? args.song;

  // 1. Cache lookup
  let record = await getLyrics(fetchArtist, fetchSong);

  // 2. If cache miss, check negative cache for non-overrides
  if (!record && !args.override) {
    const negative = await getNoLyrics(fetchArtist, fetchSong);
    if (negative) {
      session.outcome = "fetched-empty";
      session.button.setState("unavailable");
      return;
    }
  }

  // 3. Fetch fresh: LRCLIB → Genius fallback
  if (!record) {
    const lrcResult = await fetchLrclib({ artist: fetchArtist, song: fetchSong, durationSec: meta.durationSec });
    if (lrcResult?.syncedLyrics) {
      record = await persistLrclib(fetchArtist, fetchSong, lrcResult);
    } else {
      // No synced lyrics anywhere on LRCLIB. Fall back to Genius automatically.
      const geniusText = await fetchGeniusViaBackground(fetchArtist, fetchSong);
      if (geniusText) {
        record = await persistGenius(fetchArtist, fetchSong, geniusText);
      } else if (lrcResult?.plainLyrics) {
        // Neither synced LRC nor Genius, but LRCLIB had plain text — use that as static.
        record = await persistLrclib(fetchArtist, fetchSong, lrcResult);
      } else {
        await putNoLyrics(fetchArtist, fetchSong);
      }
    }
  }

  if (!record) {
    session.outcome = "fetched-empty";
    session.button.setState("unavailable");
    return;
  }

  await renderRecord(record);
}

async function renderRecord(record: LyricsRecord) {
  if (!session) return;
  const settings = await getSettings();
  const player = getPlayerElement();
  const video = getVideoElement();
  if (!player || !video) return;

  const overlay = new LyricsOverlay(
    player, settings,
    () => openWrongSongDialog(),
  );
  session.overlay = overlay;

  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);
    overlay.setSyncedLines(lines);
    const engine = new SyncEngine(video, lines, (idx) => overlay.render(idx));
    engine.start();
    session.engine = engine;
  } else if (record.plainLyrics) {
    overlay.setStaticText(record.plainLyrics);
  } else {
    overlay.destroy();
    session.overlay = null;
    session.outcome = "fetched-empty";
    session.button.setState("unavailable");
    return;
  }

  session.button.setState("available");
}

async function persistLrclib(artist: string, song: string, r: LrclibResult): Promise<LyricsRecord> {
  const rec: LyricsRecord = {
    syncedLyrics: r.syncedLyrics, plainLyrics: r.plainLyrics,
    source: "lrclib", lrclibId: r.id, fetchedAt: Date.now(),
  };
  await putLyrics(artist, song, rec);
  return rec;
}

async function persistGenius(artist: string, song: string, text: string): Promise<LyricsRecord> {
  const rec: LyricsRecord = {
    syncedLyrics: null, plainLyrics: text,
    source: "genius", fetchedAt: Date.now(),
  };
  await putLyrics(artist, song, rec);
  return rec;
}

async function fetchGeniusViaBackground(artist: string, song: string): Promise<string | null> {
  const search = await chrome.runtime.sendMessage({ type: "geniusSearch", query: `${artist} ${song}` });
  if (!search?.url) return null;
  const lyrics = await chrome.runtime.sendMessage({ type: "geniusFetch", url: search.url });
  return typeof lyrics === "string" ? lyrics : null;
}

function onButtonClick() {
  if (!session) return;
  if (session.overlay) {
    session.overlay.setHidden(!session.overlay.isHidden());
    return;
  }
  if (session.outcome === "never-fetched") {
    // Hard-skip filter blocked us; user is overriding. Run pipeline now.
    void runFetchPipeline({ artist: session.parsed.artist, song: session.parsed.song, override: null });
  } else {
    // Already fetched and got nothing. Let user search manually.
    openWrongSongDialog();
  }
}

function openWrongSongDialog() {
  if (!session) return;
  const player = getPlayerElement();
  if (!player) return;
  session.cleanupDialog?.();
  session.cleanupDialog = openSearchDialog(player, {
    initialArtist: session.parsed.artist,
    initialSong: session.parsed.song,
    onPick: async (r: LrclibResult) => {
      if (!session) return;
      await putOverride(session.meta.videoId, {
        artist: r.artistName, title: r.trackName, lrclibId: r.id, setAt: Date.now(),
      });
      await persistLrclib(r.artistName, r.trackName, r);
      session.cleanupDialog?.();
      void run();
    },
    onClose: () => { session?.cleanupDialog?.(); },
  });
}

function teardown() {
  session?.engine?.destroy();
  session?.overlay?.destroy();
  session?.button?.destroy();
  session?.cleanupDialog?.();
  session = null;
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === "openManualSearch" && session) {
    openWrongSongDialog();
  }
});

onYoutubeNavigation(() => { void run(); });
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: clean build, `dist/` populated.

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all unit tests pass (normalizer, lrc-parser, cache, lrclib, detector, sync-engine, settings).

- [ ] **Step 5: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: content script orchestrator wires the full pipeline"
```

---

## Task 17: Manual test checklist + load extension

**Files:**
- Create: `docs/superpowers/testing/manual-checklist.md`

- [ ] **Step 1: Write checklist**

```markdown
# Manual Test Checklist — v1

Load unpacked extension from `dist/` in `chrome://extensions/` (Developer mode on).

## Smoke
- [ ] Open https://www.youtube.com → no errors in console
- [ ] Open a popular Vevo music video → button appears, lyrics overlay shows
- [ ] Lyrics highlight current line as song plays
- [ ] Seek forward in the video → highlight jumps to correct line
- [ ] Pause → highlight freezes; resume → continues

## Detection
- [ ] Open a podcast video → no overlay (still see button if visible at all)
- [ ] Open a YouTube Short → no overlay
- [ ] Open a tutorial → no overlay
- [ ] Open a Vevo with "Reaction" in title → overlay still appears (strong signal override)
- [ ] Open a "- Topic" upload → overlay appears

## SPA navigation
- [ ] Click a related video → overlay updates (no manual reload needed)
- [ ] Use back/forward → overlay updates
- [ ] Autoplay-next → overlay updates

## Player modes
- [ ] Theater mode → overlay still visible
- [ ] Mini-player → overlay still visible (or hides gracefully)
- [ ] Fullscreen → overlay visible inside fullscreen
- [ ] Browser zoom 75% / 100% / 150% → overlay readable

## Manual override
- [ ] Right-click button → context options appear (or click → toggles)
- [ ] Click "Wrong song?" → dialog opens
- [ ] Search returns results → click one → lyrics replaced and persisted for this video
- [ ] Reload page → overridden lyrics still load

## Cache
- [ ] Watch video twice → second time loads instantly with no network call to LRCLIB
- [ ] Popup → "Clear cache" → next video re-fetches

## Settings
- [ ] Toggle enabled off → overlay disappears on next nav
- [ ] Change position to top/middle → reflected on next nav
- [ ] Increase font size → reflected on next nav
- [ ] Lower max duration to 60s → 3-min videos no longer auto-fetch

## Genius fallback
- [ ] Indie song where LRCLIB has no synced lyrics → static panel with Genius lyrics appears, header "Lyrics from Genius (not synced)"
- [ ] Static panel scrolls; sync engine is not running

## Filter override
- [ ] Open a podcast with a real song discussion → button is unavailable; click → fetch runs; if results found, overlay appears
- [ ] Open a YouTube Short → button is unavailable; click → fetch runs

## Failure modes
- [ ] Video both LRCLIB and Genius have nothing for → button stays unavailable; click button → search dialog opens
- [ ] Disconnect network → no overlay, console warn only, no UI error
```

- [ ] **Step 2: Run through checklist** (human-driven)

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/testing/manual-checklist.md
git commit -m "docs: manual test checklist for v1"
```

---

## Self-Review Notes (for reviewer)

**Spec coverage check:**

| Spec section | Implementing task |
|---|---|
| §3 Architecture (3 components) | Task 1 (manifest), Task 14 (bg), Task 15 (popup), Task 16 (content) |
| §4.1 Metadata extraction | Task 10 |
| §4.2 Hard-skip rules | Task 7 |
| §4.3 Strong music signals | Task 7 |
| §4.4 Title normalizer | Task 3 |
| §4.5 Cache lookup order | Task 16 (orchestration) |
| §5.1 LRCLIB fetch sequence | Task 6 |
| §5.2 Genius fallback (automatic) | Task 14 (background scrape) + Task 16 (`runFetchPipeline` automatically invokes after LRCLIB returns no synced lyrics) |
| §5.3 Cache schema | Tasks 2, 5 |
| §5.4 Settings schema | Tasks 2, 8 |
| §6.1 LRC parsing | Task 4 |
| §6.2 Sync loop | Task 9 |
| §6.3 Overlay element | Task 11 |
| §6.4 Drift handling | Task 9 (handleSeek) |
| §7.1 Player button | Task 12 |
| §7.2 Manual search dialog | Task 13 |
| §7.3 "Wrong song?" link | Task 11 (overlay), Task 16 (handler) |
| §7.4 Popup | Task 15 |
| §8 Error handling | Inline in Task 16 (silent fail on network errors, graceful selector misses in Task 10) |
| §10 Testing | Tasks 3-9 (unit), Task 17 (manual) |

**Spec revision note (2026-05-15):** Genius was reframed from a manual fallback to an automatic one, per user clarification. The orchestrator (Task 16) now calls Genius automatically whenever LRCLIB lacks synced lyrics, and the player button is always injected (even on hard-skipped videos) so users can override the filter. Plan and spec both updated.

**Type consistency check:** ✅ `LrclibResult.id` (number), `OverrideRecord.lrclibId` (number), `LyricsRecord.lrclibId?` (number) — all consistent. `parseLrc` returns `LrcLine[]`, consumed by `SyncEngine` and `LyricsOverlay.setSyncedLines` — consistent. `LyricsOverlay` has two entry points (`setSyncedLines`, `setStaticText`) plus `isHidden()` used by the orchestrator's button toggle.

**Placeholder scan:** ✅ no TBD/TODO/"add appropriate error handling" placeholders. Every code step has complete code.
