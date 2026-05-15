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

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKeyword(haystack: string, needle: string): boolean {
  // Word-boundary-aware match. For multi-word phrases (e.g. "let's play"), surround
  // with whitespace boundaries since \b doesn't work well with apostrophes/spaces.
  const re = /\s/.test(needle)
    ? new RegExp(`(^|\\s)${escapeRe(needle)}(\\s|$)`, "i")
    : new RegExp(`\\b${escapeRe(needle)}\\b`, "i");
  return re.test(haystack);
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => containsKeyword(haystack, n));
}

function hasStrongMusicSignal(meta: VideoMetadata): boolean {
  const t = meta.title.toLowerCase();
  if (STRONG_TITLE_SIGNALS.some((s) => t.includes(s))) return true;
  if (/vevo$/i.test(meta.channelName)) return true;
  if (/\s-\sTopic$/i.test(meta.channelName)) return true;
  return false;
}

export function shouldAutoFetch(meta: VideoMetadata, maxDurationSec: number): boolean {
  if (meta.isLive) return false;
  if (meta.durationSec < 30) return false;
  if (meta.durationSec > maxDurationSec) return false;

  if (hasStrongMusicSignal(meta)) return true;

  if (containsAny(meta.title, NON_MUSIC_TITLE_KEYWORDS)) return false;
  if (containsAny(meta.channelName, NON_MUSIC_CHANNEL_KEYWORDS)) return false;

  return true;
}
