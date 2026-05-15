import type { LrclibResult } from "../shared/types";

const BASE = "https://lrclib.net";

export type LrclibQuery = { artist: string; song: string; durationSec: number };

export async function fetchLrclib(q: LrclibQuery): Promise<LrclibResult | null> {
  const exactUrl =
    `${BASE}/api/get?artist_name=${encodeURIComponent(q.artist)}` +
    `&track_name=${encodeURIComponent(q.song)}&duration=${q.durationSec}`;
  const exact = await fetch(exactUrl);
  if (exact.ok) return (await exact.json()) as LrclibResult;

  const searchUrl = `${BASE}/api/search?q=${encodeURIComponent(`${q.artist} ${q.song}`)}`;
  const searchResp = await fetch(searchUrl);
  if (!searchResp.ok) return null;
  const results = (await searchResp.json()) as LrclibResult[];
  const candidates = results
    .filter((r) => Math.abs(r.duration - q.durationSec) <= 2)
    .sort(
      (a, b) => Math.abs(a.duration - q.durationSec) - Math.abs(b.duration - q.durationSec),
    );
  return candidates[0] ?? null;
}
