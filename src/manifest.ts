import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json";

export default defineManifest({
  manifest_version: 3,
  name: "YouTube Synced Lyrics",
  version: pkg.version,
  description: "Auto-fetched synced lyrics for YouTube music videos",
  icons: { 16: "icons/16.png", 48: "icons/48.png", 128: "icons/128.png" },
  action: { default_popup: "src/popup/index.html", default_icon: { 16: "icons/16.png", 48: "icons/48.png", 128: "icons/128.png" } },
  background: { service_worker: "src/background/index.ts", type: "module" },
  content_scripts: [
    {
      matches: ["https://www.youtube.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage"],
  host_permissions: [
    "https://www.youtube.com/*",
    "https://lrclib.net/*",
    "https://genius.com/*",
  ],
});
