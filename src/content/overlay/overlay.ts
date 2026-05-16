import type { LrcLine, UserSettings } from "../../shared/types";
import "./overlay.css";

export type OverlayMode = "synced" | "static";

export class LyricsOverlay {
  private el: HTMLDivElement;
  private prevEl: HTMLDivElement;
  private activeEl: HTMLDivElement;
  private nextEl: HTMLDivElement;
  private staticEl: HTMLDivElement;
  private staticHeaderEl: HTMLDivElement;
  private controlsEl: HTMLDivElement;
  private lines: LrcLine[] = [];
  private mode: OverlayMode = "synced";

  constructor(parent: HTMLElement, settings: UserSettings, onWrongSong: () => void) {
    this.el = document.createElement("div");
    this.el.className = "ytlyrics-overlay";
    this.el.dataset.mode = "synced";
    this.el.dataset.position = settings.position;
    this.el.style.fontSize = `${settings.fontSize}px`;
    this.el.dataset.hidden = "false";

    this.staticHeaderEl = document.createElement("div");
    this.staticHeaderEl.className = "ytlyrics-static-header";
    this.staticHeaderEl.textContent = "Lyrics from Genius (not synced)";
    this.staticEl = document.createElement("div");
    this.staticEl.className = "ytlyrics-static";

    this.prevEl = document.createElement("div");
    this.prevEl.className = "ytlyrics-line ytlyrics-prev";
    this.activeEl = document.createElement("div");
    this.activeEl.className = "ytlyrics-line ytlyrics-active";
    this.nextEl = document.createElement("div");
    this.nextEl.className = "ytlyrics-line ytlyrics-next";

    this.controlsEl = document.createElement("div");
    this.controlsEl.className = "ytlyrics-controls";
    const wrong = document.createElement("a");
    wrong.textContent = "Wrong song?";
    wrong.addEventListener("click", onWrongSong);
    this.controlsEl.appendChild(wrong);

    this.el.append(
      this.staticHeaderEl, this.staticEl,
      this.prevEl, this.activeEl, this.nextEl,
      this.controlsEl,
    );
    this.applyModeVisibility();
    parent.appendChild(this.el);
  }

  setSyncedLines(lines: LrcLine[]): void {
    this.mode = "synced";
    this.el.dataset.mode = "synced";
    this.applyModeVisibility();
    this.lines = lines;
    this.render(-1);
  }

  setStaticText(text: string): void {
    this.mode = "static";
    this.el.dataset.mode = "static";
    this.applyModeVisibility();
    this.staticEl.textContent = text;
  }

  render(idx: number): void {
    if (this.mode !== "synced") return;
    this.prevEl.textContent = idx > 0 ? (this.lines[idx - 1]?.text ?? "") : "";
    this.activeEl.textContent = idx >= 0 ? (this.lines[idx]?.text ?? "") : "";
    this.nextEl.textContent = idx + 1 < this.lines.length ? (this.lines[idx + 1]?.text ?? "") : "";
  }

  setHidden(hidden: boolean): void {
    this.el.dataset.hidden = String(hidden);
  }

  isHidden(): boolean {
    return this.el.dataset.hidden === "true";
  }

  applySettings(s: UserSettings): void {
    this.el.dataset.position = s.position;
    this.el.style.fontSize = `${s.fontSize}px`;
  }

  destroy(): void {
    this.el.remove();
  }

  private applyModeVisibility(): void {
    const synced = this.mode === "synced";
    this.prevEl.style.display = synced ? "" : "none";
    this.activeEl.style.display = synced ? "" : "none";
    this.nextEl.style.display = synced ? "" : "none";
    this.staticHeaderEl.style.display = synced ? "none" : "";
    this.staticEl.style.display = synced ? "none" : "";
  }
}
