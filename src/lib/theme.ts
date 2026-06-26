export const APP_THEME_STORAGE_KEY = "sector-pro-theme";
export const LEGACY_THEME_STORAGE_KEY = "theme-preference";

export type StoredThemePreference = "light" | "dark" | "system";
export type ExplicitThemePreference = "light" | "dark";

const isStoredThemePreference = (value: string | null): value is StoredThemePreference =>
  value === "light" || value === "dark" || value === "system";

export const isExplicitThemePreference = (value: string | null): value is ExplicitThemePreference =>
  value === "light" || value === "dark";

const readStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageValue = (key: string, value: string) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or embedded webviews.
  }
};

const removeStorageValue = (key: string) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing or embedded webviews.
  }
};

export const getStoredThemePreference = (): StoredThemePreference | null => {
  const appPreference = readStorageValue(APP_THEME_STORAGE_KEY);
  if (isStoredThemePreference(appPreference)) {
    return appPreference;
  }

  const legacyPreference = readStorageValue(LEGACY_THEME_STORAGE_KEY);
  return isExplicitThemePreference(legacyPreference) ? legacyPreference : null;
};

export const getStoredExplicitThemePreference = (): ExplicitThemePreference | null => {
  const preference = getStoredThemePreference();
  return isExplicitThemePreference(preference) ? preference : null;
};

export const persistThemePreference = (preference: StoredThemePreference) => {
  writeStorageValue(APP_THEME_STORAGE_KEY, preference);

  if (isExplicitThemePreference(preference)) {
    writeStorageValue(LEGACY_THEME_STORAGE_KEY, preference);
  } else {
    removeStorageValue(LEGACY_THEME_STORAGE_KEY);
  }
};

export const persistExplicitThemePreference = (preference: ExplicitThemePreference) => {
  writeStorageValue(APP_THEME_STORAGE_KEY, preference);
  writeStorageValue(LEGACY_THEME_STORAGE_KEY, preference);
};

export const migrateLegacyThemePreference = (): StoredThemePreference | null => {
  const appPreference = readStorageValue(APP_THEME_STORAGE_KEY);
  if (isStoredThemePreference(appPreference)) {
    return appPreference;
  }

  const legacyPreference = readStorageValue(LEGACY_THEME_STORAGE_KEY);
  if (!isExplicitThemePreference(legacyPreference)) {
    return null;
  }

  persistExplicitThemePreference(legacyPreference);
  return legacyPreference;
};

export const explicitPreferenceFromDarkMode = (darkMode: boolean): ExplicitThemePreference =>
  darkMode ? "dark" : "light";

export const resolveSystemThemePreference = (): ExplicitThemePreference => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return "dark";
};

export const isDarkThemePreference = (preference: StoredThemePreference): boolean =>
  preference === "dark" || (preference === "system" && resolveSystemThemePreference() === "dark");
