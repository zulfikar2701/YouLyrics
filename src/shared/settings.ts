import { DEFAULT_SETTINGS, type UserSettings } from "./types";

export async function getSettings(): Promise<UserSettings> {
  const raw = await chrome.storage.sync.get(["settings"]);
  return { ...DEFAULT_SETTINGS, ...((raw.settings as Partial<UserSettings>) ?? {}) };
}

export async function setSettings(patch: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.sync.set({ settings: { ...current, ...patch } });
}
