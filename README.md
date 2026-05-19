# YouTube Synced Lyrics

A Chrome/Edge extension that automatically displays synced lyrics on YouTube music videos. No clicks needed — just play a song and lyrics appear.

## How It Works

1. You open a YouTube video
2. The extension extracts the song title and artist from the video
3. It searches for lyrics in this order:
   - **LRCLIB synced lyrics** (time-stamped, scrolls with the music)
   - **LRCLIB plain lyrics** (full text, not synced)
   - **Genius lyrics** (full text, scraped from genius.com)
4. If none are found, it shows "Lyrics not found" with a manual search option

The lyrics overlay appears at the bottom of the video player and moves up when YouTube controls are visible.

## Installation

### Chrome

1. Download or clone this repo
2. Run `npm install && npm run build`
3. Open `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked**
6. Select the `dist/` folder inside this project

### Edge

1. Download or clone this repo
2. Run `npm install && npm run build`
3. Open `edge://extensions/`
4. Enable **Developer mode** (toggle in left sidebar)
5. Click **Load unpacked**
6. Select the `dist/` folder inside this project

### Updating

1. Pull the latest changes (or re-download)
2. Run `npm run build`
3. Go to your extensions page
4. Click the refresh/reload icon on the extension card

## What Works Well

- Songs from official artist channels (e.g. "Drake - Jimmy Cooks")
- Music videos with "Official Video", "Official Audio", or "Lyric Video" in the title
- YouTube Music auto-generated videos (channels ending in "- Topic")
- Vevo uploads
- Most popular songs released after 2010

## What May Not Have Lyrics

- Obscure or indie tracks not in LRCLIB or Genius
- Remixes, mashups, and fan edits
- Live concert recordings
- Region-specific or non-English songs (coverage varies)
- Very new releases (lyrics databases may lag by a few days)

## When Lyrics Aren't Found

If the overlay shows "Lyrics not found":

1. Click **"Wrong song?"** in the overlay controls
2. A search dialog opens — edit the artist/title and search LRCLIB directly
3. Pick the correct result from the list
4. The lyrics will load and the correct match is saved for next time

You can also right-click the music note button in the player controls to open the search dialog.

## Controls

| Action | What it does |
|--------|-------------|
| Click the music note button | Toggle lyrics visibility (show/hide) |
| Right-click the music note button | Open manual search dialog |
| Click "Wrong song?" | Open manual search dialog |
| Click **+** / **-** arrows | Adjust sync offset by 0.5s (for synced lyrics) |

The sync offset is saved per song, so if a track is consistently early or late, you only need to adjust once.

## Extension Popup

Click the extension icon in your browser toolbar to access settings:

- **Enable/Disable** the extension
- **Font size** for lyrics text
- **Position** (bottom, middle, or top of the video)
- **Max duration** — skip lyrics fetch for videos longer than this (default: 15 min)

## Skipped Automatically

The extension will not attempt to fetch lyrics for:

- Live streams
- Videos shorter than 30 seconds
- Videos longer than the max duration setting (default 15 minutes)

## Development

```bash
npm install          # install dependencies
npm run dev          # dev server with HMR
npm run build        # production build → dist/
npm test             # run tests
npm run test:watch   # tests in watch mode
```

## Tech Stack

- TypeScript, Vite, Manifest V3
- Preact (popup UI + search dialog)
- LRCLIB API (synced + plain lyrics)
- Genius (plain lyrics fallback, scraped via background service worker)
- chrome.storage.local for caching, chrome.storage.sync for settings
