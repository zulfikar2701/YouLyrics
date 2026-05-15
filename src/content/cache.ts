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
