import type { LrcLine } from "../shared/types";

export function findLineIndex(lines: LrcLine[], time: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.time <= time) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export type LineChangeCallback = (index: number) => void;

export class SyncEngine {
  private rafId: number | null = null;
  private currentIndex = -2;

  constructor(
    private video: HTMLVideoElement,
    private lines: LrcLine[],
    private onLineChange: LineChangeCallback,
  ) {}

  start(): void {
    this.video.addEventListener("seeked", this.handleSeek);
    this.video.addEventListener("play", this.loop);
    this.video.addEventListener("pause", this.stop);
    if (!this.video.paused) this.loop();
    else this.tick();
  }

  stop = (): void => {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  };

  destroy(): void {
    this.stop();
    this.video.removeEventListener("seeked", this.handleSeek);
    this.video.removeEventListener("play", this.loop);
    this.video.removeEventListener("pause", this.stop);
  }

  setLines(lines: LrcLine[]): void {
    this.lines = lines;
    this.currentIndex = -2;
    this.tick();
  }

  loop = (): void => {
    this.tick();
    this.rafId = requestAnimationFrame(this.loop);
  };

  handleSeek = (): void => {
    this.currentIndex = -2;
    this.tick();
  };

  tick(): void {
    const idx = findLineIndex(this.lines, this.video.currentTime);
    if (idx !== this.currentIndex) {
      this.currentIndex = idx;
      this.onLineChange(idx);
    }
  }
}
