// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { APP_THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY } from "@/lib/theme";

const { authStateMock, fromMock, setThemeMock } = vi.hoisted(() => ({
  authStateMock: vi.fn(),
  fromMock: vi.fn(),
  setThemeMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: () => authStateMock(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: setThemeMock }),
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { ThemePreferenceSync } from "@/components/ThemePreferenceSync";

const createProfileQuery = (darkMode: boolean | null) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { dark_mode: darkMode },
      error: null,
    }),
  };

  return query;
};

describe("ThemePreferenceSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    authStateMock.mockReturnValue({
      user: { id: "user-1" },
      isLoading: false,
    });
  });

  it("keeps a local persisted theme instead of reading the database fallback", async () => {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, "dark");

    render(<ThemePreferenceSync />);

    await waitFor(() => {
      expect(setThemeMock).toHaveBeenCalledWith("dark");
    });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("uses the database preference only when there is no local theme", async () => {
    fromMock.mockReturnValue(createProfileQuery(true));

    render(<ThemePreferenceSync />);

    await waitFor(() => {
      expect(setThemeMock).toHaveBeenCalledWith("dark");
    });

    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("dark");
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe("dark");
  });
});
