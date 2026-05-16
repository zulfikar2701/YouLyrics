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

## Genius fallback
- [ ] Indie song where LRCLIB has no synced lyrics → static panel with Genius lyrics appears, header "Lyrics from Genius (not synced)"
- [ ] Static panel scrolls; sync engine is not running

## Filter override
- [ ] Open a podcast with a real song discussion → button is unavailable; click → fetch runs; if results found, overlay appears
- [ ] Open a YouTube Short → button is unavailable; click → fetch runs

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

## Failure modes
- [ ] Video both LRCLIB and Genius have nothing for → button stays unavailable; click button → search dialog opens
- [ ] Disconnect network → no overlay, console warn only, no UI error
