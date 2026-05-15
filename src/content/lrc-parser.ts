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
      const frac = parseFloat(`0.${fracStr}`);
      stamps.push(min * 60 + sec + frac);
    }
    if (stamps.length === 0) continue;
    const lastEnd = raw.lastIndexOf("]");
    const textPart = raw.slice(lastEnd + 1).replace(WORD_TAG_RE, "").replace(/\s+/g, " ").trim();
    for (const t of stamps) {
      lines.push({ time: t, text: textPart });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}
