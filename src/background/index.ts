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
    /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g,
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
