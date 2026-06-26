// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  APP_THEME_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  getStoredThemePreference,
  migrateLegacyThemePreference,
  persistExplicitThemePreference,
} from "@/lib/theme";

describe("theme storage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("prefers the app theme key over the legacy key", () => {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, "dark");
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "light");

    expect(getStoredThemePreference()).toBe("dark");
  });

  it("migrates a valid legacy theme into the app theme key", () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "light");

    expect(migrateLegacyThemePreference()).toBe("light");
    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("light");
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe("light");
  });

  it("persists explicit theme choices to both current and legacy keys", () => {
    persistExplicitThemePreference("dark");

    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("dark");
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe("dark");
  });
});
