export const preferenceKeys = ["chatLargeText", "chatCompact", "chatDark"] as const;
export type PreferenceKey = typeof preferenceKeys[number];
export type ChatPreferences = Record<PreferenceKey, boolean>;

export function readPreferences(): ChatPreferences {
  return Object.fromEntries(preferenceKeys.map(key => [key, document.documentElement.dataset[key] === "true"])) as ChatPreferences;
}

export function restorePreferences() {
  for (const key of preferenceKeys) {
    try { document.documentElement.dataset[key] = String(localStorage.getItem(key) === "true"); }
    catch { /* Retain the current preference if storage is unavailable. */ }
  }
}

export function savePreference(key: PreferenceKey, value: boolean): boolean {
  document.documentElement.dataset[key] = String(value);
  try { localStorage.setItem(key, String(value)); return true; }
  catch { return false; }
}
