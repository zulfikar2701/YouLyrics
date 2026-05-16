import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getSettings, setSettings } from "../shared/settings";
import { DEFAULT_SETTINGS, type UserSettings } from "../shared/types";
import "./popup.css";

export function App() {
  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => { void getSettings().then(setS); }, []);

  function update(patch: Partial<UserSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    void setSettings(patch);
  }

  return h("div", { class: "popup" },
    h("h2", null, "YT Synced Lyrics"),
    h("label", null,
      h("input", {
        type: "checkbox", checked: s.enabled,
        onChange: (e: Event) =>
          update({ enabled: (e.target as HTMLInputElement).checked }),
      }),
      " Enabled",
    ),
    h("label", null,
      "Position",
      h("select", {
        value: s.position,
        onChange: (e: Event) =>
          update({ position: (e.target as HTMLSelectElement).value as UserSettings["position"] }),
      },
        h("option", { value: "top" }, "Top"),
        h("option", { value: "middle" }, "Middle"),
        h("option", { value: "bottom" }, "Bottom"),
      ),
    ),
    h("label", null,
      `Font size: ${s.fontSize}px`,
      h("input", {
        type: "range", min: 14, max: 40, value: s.fontSize,
        onInput: (e: Event) =>
          update({ fontSize: parseInt((e.target as HTMLInputElement).value, 10) }),
      }),
    ),
    h("label", null,
      `Max video duration: ${Math.round(s.maxDurationSec / 60)} min`,
      h("input", {
        type: "range", min: 60, max: 3600, step: 60, value: s.maxDurationSec,
        onInput: (e: Event) =>
          update({ maxDurationSec: parseInt((e.target as HTMLInputElement).value, 10) }),
      }),
    ),
    h("label", null,
      h("input", {
        type: "checkbox", checked: s.showInFullscreen,
        onChange: (e: Event) =>
          update({ showInFullscreen: (e.target as HTMLInputElement).checked }),
      }),
      " Show in fullscreen",
    ),
    h("button", {
      onClick: async () => {
        await chrome.storage.local.clear();
        alert("Cache cleared");
      },
    }, "Clear cache"),
    h("button", {
      onClick: async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "openManualSearch" });
        window.close();
      },
    }, "Open manual search"),
  );
}
