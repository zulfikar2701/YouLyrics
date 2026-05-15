# YouTube Synced Lyrics — Chrome Extension (v1 Design)

**Date:** 2026-05-15
**Status:** Design — pending user review
**Author:** Brainstorming session with Devin

---

## 1. Problem & Goal

When watching music videos on YouTube, viewers often want to read the lyrics in sync with the audio to better understand the song. There is no first-party way to do this on `youtube.com`. This project builds a Chrome extension that automatically detects music videos on YouTube, fetches time-synced lyrics (LRC format), and overlays them on the player — including in fullscreen mode.

**Primary user goal:** "I'm watching a music video on YouTube. I want synced lyrics on screen, automatically, with no friction."

**Non-goals for v1:** YouTube Music support, contributing lyrics back to any database, manual sync editor, translations, mobile, Firefox.

---

## 2. Lyrics Source Strategy

### 2.1 Primary source: LRCLIB

- Free, open, community-run lyrics database with native LRC (timestamped) support.
- No API key, no OAuth, no rate-limit headers documented.
- API supports CORS, so content scripts can call it directly when needed.

**Lookup flow:**

1. Try exact match: `GET https://lrclib.net/api/get?artist_name={a}&track_name={t}&duration={d}`
2. If 404, fall back to: `GET https://lrclib.net/api/search?q={a} {t}`
3. From search results, pick the result whose `duration` is within ±2 seconds of the YouTube video's duration.
4. Return preferred field: `syncedLyrics` if present, else `plainLyrics`.

### 2.2 Static fallback: Genius

- **Automatic** fallback. Triggered whenever LRCLIB returns no synced lyrics for a song — either no record at all, or a record with `plainLyrics` only and `syncedLyrics === null`.
- v1 implementation: search via `genius.com/api/search/multi` and scrape lyrics from the song page in the **background service worker** (bypasses CORS).
- Future option: switch to the official Genius API (requires API key + OAuth) if scraping breaks or proves fragile.
- Genius lyrics are always plain (no sync). Shown in the overlay's **static mode**: a scrollable panel with all lyrics, no per-line highlighting and no auto-scroll. The user reads at their own pace.
- If Genius also returns nothing, the overlay does not appear; the player button shows the "unavailable" state.

**Decision tree for a single song:**

```
LRCLIB /api/get → has syncedLyrics?  → render synced overlay
                ↓ no
LRCLIB /api/search → best match has syncedLyrics?  → render synced overlay
                ↓ no synced anywhere
Genius search + scrape → has plain text?  → render static overlay
                ↓ no
Show "unavailable" state on player button.
```

### 2.3 Out of scope for v1

- Contributing lyrics back to LRCLIB (PoW + `/api/publish` flow).
- MusixMatch (paid API for synced lyrics).
- NetEase / other regional sources.

---

## 3. Architecture

Manifest V3 Chrome extension with three components:

| Component | Responsibility |
|---|---|
| Content script | Injected into `youtube.com/watch*`. Detects music videos, parses titles, renders lyrics overlay inside the player, runs the sync engine. |
| Background service worker | Handles fetches that need CORS bypass (Genius scraping). LRCLIB is fetched directly from the content script. |
| Popup UI | Settings: master toggle, overlay position, font size, max-duration cap, cache management. |

**Permissions (`manifest.json`):**

- `storage` — for caching and settings
- `activeTab` — to inject the player button on demand
- Host permissions: `https://www.youtube.com/*`, `https://lrclib.net/*`, `https://genius.com/*`

### 3.1 Data flow

```
YouTube page load / yt-navigate-finish
  ↓
Content script: extract metadata
  ↓
Hard-skip rules → if matched, stop (manual search still available)
  ↓
Title normalizer → {artist, song}
  ↓
Cache lookup (lyrics: / nolyrics: / override:)
  ↓ (miss)
Fetch LRCLIB (/api/get → fallback /api/search)
  ↓
Cache result (positive 30d, negative 7d)
  ↓
Parse LRC → render overlay inside #movie_player
  ↓
Sync engine: requestAnimationFrame polls video.currentTime
```

---

## 4. Detection & Filtering Pipeline

### 4.1 Metadata extraction

From the YouTube DOM:

- `videoId` — from `URL` (`?v=...`)
- `title` — from `<h1.ytd-watch-metadata>` or `<h1.title>` selector
- `channelName` — from `<ytd-channel-name>` link text
- `duration` — from the HTML5 `<video>` element's `duration` (await `loadedmetadata` if NaN)
- `description` — from `#description` (used to detect "Music in this video" section)
- `liveBadge` — presence of `.ytp-live-badge` indicates live stream → skip

### 4.2 Hard-skip rules (no auto-fetch — but the player button is still injected and clickable for manual search)

Skip if **any** of:

- `duration < 30s` (Shorts, clips, ads)
- `duration > 15min` (configurable; default cap)
- Live stream badge present
- Title contains (case-insensitive, whole-word match) any of:
  `podcast`, `interview`, `vlog`, `tutorial`, `gameplay`, `let's play`, `walkthrough`, `unboxing`, `review`, `reaction`, `commentary`, `highlights`, `news`, `livestream`, `stream`, `q&a`, `ama`, `episode`, `ep.`, `how to`, `explained`, `documentary`
- Channel name contains (whole-word): `news`, `gaming`, `podcast`, `tv`

### 4.3 Strong music signals (always fetch, even if a soft non-music keyword is present)

If **any** match, override soft skips:

- Channel name ends with `VEVO` (case-insensitive) → e.g. `EdSheeranVEVO`
- Channel name ends with ` - Topic` (YouTube auto-generated)
- Title contains: `Official Video`, `Official Music Video`, `Official Audio`, `(Audio)`, `[MV]`, `Music Video`, `Lyric Video`, `Lyrics Video`
- Description contains "Music in this video" section (YouTube Content ID match)
- Page metadata `<meta itemprop="genre">` value is `Music`
- Title matches `^.+\s+-\s+.+$` (single dash with surrounding spaces)

### 4.4 Title normalizer

Goal: produce `{artist, song}` from a noisy YouTube title.

Steps (in order):

1. Strip Unicode brackets: `[...]`, `(...)`, `【...】`, `《...》`, `「...」`, etc.
2. Strip suffixes: ` - Topic`, ` VEVO`
3. Strip noise tokens (case-insensitive): `Official Video`, `Official Music Video`, `Official Audio`, `Music Video`, `Lyric Video`, `Lyrics Video`, `HD`, `4K`, `Audio`, `Visualizer`, `Remastered`, `Extended`
4. Strip `ft.|feat.|featuring` and everything after
5. Trim, collapse whitespace
6. Split on first ` - ` (dash with surrounding spaces). If split succeeds:
   - `artist` = left, `song` = right
7. If no dash and channel name ends with ` - Topic`, strip ` - Topic` → use as `artist`; `song` = remaining title
8. If still no artist, `artist = channelName`, `song = title`

The normalizer is a pure function with **dedicated unit tests** covering at least 30 real-world title patterns. This is the bug-prone part of the system.

### 4.5 Cache lookup

Order:

1. `override:{videoId}` → user has manually picked lyrics for this video → use that record's `lrclibId` directly
2. `lyrics:{normalized_artist}|{normalized_title}` → use if `fetchedAt < 30 days` ago
3. `nolyrics:{normalized_artist}|{normalized_title}` → skip auto-fetch if `checkedAt < 7 days` ago

---

## 5. Lyrics Fetching & Caching

### 5.1 Fetch sequence (LRCLIB)

```
async function fetchLrclib({ artist, song, duration }) {
  // exact-match endpoint
  const exact = await GET `/api/get?artist_name=${artist}&track_name=${song}&duration=${duration}`
  if (exact.ok) return exact.body

  // search fallback
  const results = await GET `/api/search?q=${artist} ${song}`
  const best = results
    .filter(r => Math.abs(r.duration - duration) <= 2)
    .sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration))[0]
  return best ?? null
}
```

### 5.2 Genius fallback (automatic)

- Triggered automatically whenever LRCLIB does not produce synced lyrics (no record at all, or only plain text).
- Content script sends a `geniusFetch` runtime message to the background worker with the parsed `{artist, song}`.
- Background worker fetches `https://genius.com/api/search/multi?q={artist} {song}`, parses JSON, picks the first `song` section hit.
- Background worker fetches the song page HTML, extracts lyrics from `[data-lyrics-container]` divs (current Genius DOM convention; documented in code with date-stamped comment so the parser is easy to update).
- Returns plain text only.
- Result is cached as a `LyricsRecord` with `source: "genius"`, `syncedLyrics: null`, `plainLyrics: <text>`.

### 5.3 Cache schema (`chrome.storage.local`)

```ts
type LyricsRecord = {
  syncedLyrics: string | null;   // raw LRC text
  plainLyrics: string | null;
  source: "lrclib" | "genius";
  lrclibId?: number;
  fetchedAt: number;             // epoch ms
};

type NoLyricsRecord = {
  source: "lrclib";
  checkedAt: number;
};

type OverrideRecord = {
  artist: string;
  title: string;
  lrclibId: number;
  setAt: number;
};

// keys
//   lyrics:{normalized_artist}|{normalized_title}
//   nolyrics:{normalized_artist}|{normalized_title}
//   override:{videoId}
```

TTL is enforced **lazily on read** (check timestamp, evict if stale). No background cleanup in v1.

### 5.4 Settings schema (`chrome.storage.sync`)

```ts
type UserSettings = {
  enabled: boolean;              // master toggle, default true
  position: "top" | "middle" | "bottom"; // default "bottom"
  fontSize: number;              // px, default 22, range 14-40
  maxDurationSec: number;        // default 900 (15min)
  showInFullscreen: boolean;     // default true
};
```

---

## 6. Sync Engine & Overlay

### 6.1 LRC parsing

Parse standard LRC format:

```
[00:12.34] Like the legend of the phoenix
[00:16.78] All ends with beginnings
```

Output:

```ts
type LrcLine = { time: number; text: string };  // time in seconds
type ParsedLrc = LrcLine[];                      // sorted ascending by time
```

Word-level enhanced LRC (`<00:12.34>`) is parsed but only used for word highlighting if every line has it; otherwise line-only mode.

### 6.2 Sync loop

- `requestAnimationFrame(tick)` while overlay is visible and video is playing.
- Maintain `currentIndex` pointing into `parsedLrc`.
- On each frame:
  - Read `videoElement.currentTime`
  - If `currentTime >= parsedLrc[currentIndex + 1]?.time`, increment index and re-render
- On `seeked` event, recalculate `currentIndex` via binary search over timestamps.
- On `pause`, stop RAF; on `play`, resume.

### 6.3 Overlay element

- Injected as a direct child of `#movie_player` (so it remains visible when the player goes fullscreen).
- DOM structure (single shadow-root or scoped CSS to avoid clashing with YouTube styles):
  ```
  <div class="ytlyrics-overlay" data-mode="compact">
    <div class="ytlyrics-line ytlyrics-prev"></div>
    <div class="ytlyrics-line ytlyrics-active"></div>
    <div class="ytlyrics-line ytlyrics-next"></div>
    <div class="ytlyrics-controls">...</div>
  </div>
  ```
- Default styling: bottom-third position, semi-transparent dark gradient background, white text, drop shadow for legibility.
- Three display modes:
  - **Synced compact** (default for synced lyrics): 3 lines — previous / current (highlighted, scaled 1.1x) / next
  - **Synced expanded** (toggle from compact): scrollable panel with all lyrics; current line auto-scrolled into view
  - **Static** (used for Genius plain-text fallback): scrollable panel with all lyrics, no highlighting, no auto-scroll. Header text "Lyrics from Genius (not synced)" makes the source explicit.

### 6.4 Drift handling

- Seek → binary search to recompute index.
- Pause → freeze on current line, no advancement.
- Speed change (`playbackRate`) → no special handling needed; `currentTime` already reflects it.
- Buffering → no special handling; `currentTime` doesn't advance during stalls.

---

## 7. User Controls

### 7.1 Player button

- Injected into `.ytp-right-controls` on **every** video page (regardless of detection result), so users can always recover when the filter is too restrictive.
- Music-note icon. Three states reflected in styling:
  - **Loading** (pulsing): fetch in flight
  - **Available** (solid): lyrics loaded for this video (synced or static)
  - **Unavailable** (dimmed): hard-skip filter matched, OR fetch completed and nothing was found
- Click behavior depends on state:
  - **Available** → toggle overlay visibility on/off
  - **Unavailable, never fetched** (hard-skip filter blocked auto-fetch) → trigger a manual fetch attempt right now (treats this video as music despite the filter; pipeline runs LRCLIB → Genius)
  - **Unavailable, already fetched** (LRCLIB and Genius both returned nothing) → open the manual search dialog so the user can try a different artist/song
- Right-click → context menu: `Search manually...`, `Wrong song?`, `Settings`.

### 7.2 Manual search dialog

- Modal injected into `#movie_player` (so it works in fullscreen too).
- Pre-filled `artist` and `song` inputs from the title parser.
- "Search LRCLIB" button → list of results with album, duration, and a "✓ has sync" badge.
- Click result → write `override:{videoId}` record, load lyrics, close dialog.
- "Try Genius (plain text only)" link at the bottom.

### 7.3 "Wrong song?" link

- Small text link at the bottom-right of the overlay.
- Opens the manual search dialog, pre-filled with current artist/song so the user can edit and re-search.

### 7.4 Popup (toolbar icon)

- Master enable/disable toggle.
- Overlay position selector (top / middle / bottom).
- Font size slider (14–40px).
- Max video duration for auto-detect (default 900s).
- Show in fullscreen toggle (default on).
- "Clear cache" button.
- "Open manual search" button — sends a `chrome.runtime` message to the active YouTube tab's content script, which opens the dialog inside the player. (The popup itself does not host the search dialog because results need to apply to the currently-watched video.)

---

## 8. Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| LRCLIB network failure | Log to console, no user-facing toast unless explicit search. Cache nothing (let user retry). |
| LRCLIB returns 404 | Write `nolyrics:` record (TTL 7d). Overlay hidden. |
| YouTube DOM selector missing (layout change) | Detection returns gracefully. Log a warning with selector name. Overlay does not appear. Manual search still works. |
| Duplicate `yt-navigate-finish` events | Debounce 500ms before running pipeline. |
| Live stream / premiere | Detected via `.ytp-live-badge`, skipped. |
| Cover / remix / live version where sync drifts | User clicks "Wrong song?" → manual search → picks correct version. Choice cached as override. |
| Video replayed | Cache hit, instant load, sync resets to time 0. |
| User seeks during playback | Binary search recomputes line index. |
| Multiple tabs playing different videos | Each content script instance is independent; chrome.storage is shared. No cross-tab coordination needed. |
| Storage quota exceeded | `chrome.storage.local` has 10MB limit. With ~5KB per record, that's ~2000 songs cached. v1 doesn't auto-evict; "Clear cache" button is the escape hatch. v2 may add LRU. |

---

## 9. Tech Stack

- **Build:** Vite + `@crxjs/vite-plugin` (HMR for content scripts during development)
- **Language:** TypeScript (strict mode)
- **UI for popup & manual search dialog:** Preact (~3KB, JSX, hooks)
- **Styling:** Plain CSS modules. No Tailwind (extension bundle size matters).
- **Tests:** Vitest + happy-dom
- **Lint/format:** ESLint + Prettier with extension-aware config

Bundle size target: < 100KB gzipped total.

---

## 10. Testing Approach

### 10.1 Unit tests (Vitest)

- **Title normalizer:** ≥30 real-world title patterns, including:
  - `Daft Punk - Get Lucky (Official Music Video) ft. Pharrell [HD]`
  - `Beyoncé - Halo`
  - `[Music Video] AKMU - HEY KID, CLOSE YOUR EYES`
  - `Ed Sheeran - Shape of You [Official Lyric Video]`
  - YouTube Topic channel uploads
  - Titles with no dash
  - Titles with multiple dashes
  - CJK titles
- **LRC parser:** standard LRC, enhanced LRC, malformed LRC, lines with offsets
- **Cache eviction:** TTL boundaries, override precedence
- **Hard-skip rules:** keyword matching, duration boundaries

### 10.2 Integration tests

- Mock `fetch` for LRCLIB; verify retry/fallback paths.
- Mock `chrome.storage.local`; verify cache writes and reads.
- Render overlay in happy-dom; verify line advancement when `currentTime` changes.

### 10.3 Manual test matrix

A documented checklist (`docs/superpowers/testing/manual-checklist.md`) covering:

- Top-50 popular music videos (Vevo, indie, Topic channels)
- Edge cases: covers, live versions, lyric videos, remixes, instrumentals
- Player modes: theater, mini-player, fullscreen, dark/light theme
- Browser zoom levels: 75%, 100%, 150%
- SPA navigation: forward/back buttons, autoplay-next, search-result clicks
- Manual override flow: pick wrong → switch via "Wrong song?"

---

## 11. Out of Scope for v1

- YouTube Music (`music.youtube.com`)
- Lyrics contribution to LRCLIB (proof-of-work + `/api/publish`)
- Manual sync editor / "tap to sync" mode
- Karaoke-style word-by-word highlighting when LRC has no word tags
- Translation
- Multi-video playlist memory (each video is independent)
- Mobile browsers
- Firefox (Manifest V3 may work, but explicitly untested)
- LRU cache eviction (rely on user-triggered "Clear cache" for v1)

---

## 12. Open Questions

None at design time. All major forks have been resolved:

- ✅ Source: LRCLIB primary, Genius static fallback (manual only)
- ✅ Sync: LRC timestamps + RAF polling
- ✅ Detection: always-try with hard-skip filters + manual button
- ✅ Surface: regular YouTube only (no YT Music in v1)
- ✅ Contribution: descoped from v1
- ✅ Stack: Vite + TS + Preact

---

## 13. Next Step

After user approval of this spec, invoke the `writing-plans` skill to break the design into a sequence of bite-sized implementation tasks (each 2–5 minutes of focused work) with exact file paths, complete code, and verification steps.
