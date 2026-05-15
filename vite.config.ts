import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import preact from "@preact/preset-vite";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: { rollupOptions: { input: { popup: "src/popup/index.html" } } },
  test: { environment: "happy-dom", globals: true, include: ["tests/**/*.test.ts"] },
});
