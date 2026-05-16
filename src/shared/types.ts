export type LyricsRecord = {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: "lrclib" | "genius";
  lrclibId?: number;
  fetchedAt: number;
  offset?: number; // seconds, applied to all LRC timestamps; user-adjustable
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
