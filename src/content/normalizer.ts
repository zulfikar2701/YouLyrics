import type { ParsedSong } from "../shared/types";

const BRACKET_PAIRS: [string, string][] = [
  ["(", ")"],
  ["[", "]"],
  ["【", "】"],
  ["《", "》"],
  ["「", "」"],
  ["『", "』"],
];

const NOISE_TOKENS = [
  "official music video",
  "official video",
  "official audio",
  "official lyric video",
  "music video",
  "lyric video",
  "lyrics video",
  "audio",
  "visualizer",
  "remastered",
  "remaster",
  "extended",
  "hd",
  "4k",
  "8k",
  "hq",
];

const FEAT_RE = /\s+(?:feat\.?|ft\.?|featuring)\b.*$/i;
const VEVO_SUFFIX_RE = /\s+VEVO\s*$/i;
const TOPIC_SUFFIX_RE = /\s+-\s+Topic\s*$/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBrackets(s: string): string {
  let out = s;
  for (const [open, close] of BRACKET_PAIRS) {
    const re = new RegExp(`${escapeRe(open)}[^${escapeRe(open)}${escapeRe(close)}]*${escapeRe(close)}`, "g");
    out = out.replace(re, " ");
  }
  return out;
}

function stripNoiseTokens(s: string): string {
  let out = s;
  for (const tok of NOISE_TOKENS) {
    out = out.replace(new RegExp(`\\b${escapeRe(tok)}\\b`, "gi"), " ");
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
