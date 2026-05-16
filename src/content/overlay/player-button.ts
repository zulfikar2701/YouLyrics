export type ButtonState = "loading" | "available" | "unavailable";

const ICON_SVG = `<svg height="100%" viewBox="0 0 24 24" width="100%" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>`;

export class PlayerButton {
  private btn: HTMLButtonElement;

  constructor(parent: HTMLElement, onClick: () => void, onContext: (e: MouseEvent) => void) {
    this.btn = document.createElement("button");
    this.btn.className = "ytp-button ytlyrics-button";
    this.btn.title = "Lyrics";
    this.btn.style.cssText = "width:48px;height:48px;padding:12px;";
    this.btn.innerHTML = ICON_SVG;
    this.btn.addEventListener("click", onClick);
    this.btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      onContext(e);
    });
    this.setState("unavailable");
    parent.prepend(this.btn);
  }

  setState(state: ButtonState): void {
    this.btn.dataset.state = state;
    this.btn.style.opacity =
      state === "unavailable" ? "0.5" :
      state === "loading" ? "0.7" : "1";
  }

  destroy(): void {
    this.btn.remove();
  }
}
