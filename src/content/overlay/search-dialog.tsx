import { render, h } from "preact";
import { useState } from "preact/hooks";
import type { LrclibResult } from "../../shared/types";
import "./search-dialog.css";

type Props = {
  initialArtist: string;
  initialSong: string;
  onPick: (r: LrclibResult) => void;
  onClose: () => void;
};

function Dialog({ initialArtist, initialSong, onPick, onClose }: Props) {
  const [artist, setArtist] = useState(initialArtist);
  const [song, setSong] = useState(initialSong);
  const [results, setResults] = useState<LrclibResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${song}`)}`;
      const r = await fetch(url);
      setResults(r.ok ? (await r.json()) : []);
    } finally {
      setLoading(false);
    }
  }

  return h("div", {
    class: "ytlyrics-dialog-backdrop",
    onClick: (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains("ytlyrics-dialog-backdrop")) onClose();
    },
  },
    h("div", { class: "ytlyrics-dialog" },
      h("h3", null, "Search lyrics"),
      h("input", {
        value: artist, placeholder: "Artist",
        onInput: (e: Event) => setArtist((e.target as HTMLInputElement).value),
      }),
      h("input", {
        value: song, placeholder: "Song",
        onInput: (e: Event) => setSong((e.target as HTMLInputElement).value),
      }),
      h("button", { onClick: search, disabled: loading },
        loading ? "Searching..." : "Search LRCLIB",
      ),
      h("ul", null, results.map((r) =>
        h("li", { key: r.id, onClick: () => onPick(r) },
          h("div", null,
            r.trackName, " — ", r.artistName,
            r.syncedLyrics ? h("span", { class: "badge" }, "✓ synced") : null,
          ),
          h("div", { class: "meta" }, r.albumName ?? "", " · ", `${r.duration}s`),
        ),
      )),
    ),
  );
}

export function openSearchDialog(parent: HTMLElement, props: Props): () => void {
  const root = document.createElement("div");
  parent.appendChild(root);
  render(
    h(Dialog, { ...props, onClose: () => { props.onClose(); cleanup(); } }),
    root,
  );
  function cleanup() { render(null, root); root.remove(); }
  return cleanup;
}
