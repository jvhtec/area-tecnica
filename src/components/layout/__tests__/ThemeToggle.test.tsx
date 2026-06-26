// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { APP_THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY } from "@/lib/theme";

const { setThemeMock, updatePreferencesMock, useThemeMock } = vi.hoisted(() => ({
  setThemeMock: vi.fn(),
  updatePreferencesMock: vi.fn(),
  useThemeMock: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => useThemeMock(),
}));

vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    updatePreferences: updatePreferencesMock,
  }),
}));

import { ThemeToggle } from "@/components/layout/ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useThemeMock.mockReturnValue({
      resolvedTheme: "light",
      setTheme: setThemeMock,
    });
  });

  it("does not overwrite the current theme when mounted", async () => {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, "dark");

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText("Modo claro")).toBeInTheDocument();
    });

    expect(setThemeMock).not.toHaveBeenCalled();
  });

  it("persists explicit toggles to both current and legacy storage keys", async () => {
    const user = userEvent.setup();

    render(<ThemeToggle />);

    await screen.findByText("Modo claro");
    await user.click(screen.getByRole("button", { name: /modo claro/i }));

    expect(setThemeMock).toHaveBeenCalledWith("dark");
    expect(updatePreferencesMock).toHaveBeenCalledWith({ dark_mode: true });
    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("dark");
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe("dark");
  });
});
