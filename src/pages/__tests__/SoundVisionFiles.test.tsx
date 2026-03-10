// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/renderWithProviders";

const { useOptimizedAuthMock, useThemeMock, navigateMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  useThemeMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("next-themes", () => ({
  useTheme: (...args: any[]) => useThemeMock(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/soundvision/SoundVisionAccessRequestDialog", () => ({
  SoundVisionAccessRequestDialog: ({ open }: { open: boolean }) => <div>Dialog open: {String(open)}</div>,
}));

vi.mock("@/components/soundvision/SoundVisionInteractiveMap", () => ({
  SoundVisionInteractiveMap: ({ isDark }: { isDark: boolean }) => <div>Interactive map dark:{String(isDark)}</div>,
}));

import SoundVisionFiles from "../SoundVisionFiles";

describe("SoundVisionFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeMock.mockReturnValue({ theme: "light" });
  });

  it("renders the loading spinner while auth is unresolved", () => {
    useOptimizedAuthMock.mockReturnValue({
      hasSoundVisionAccess: false,
      isLoading: true,
    });

    renderWithProviders(<SoundVisionFiles />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("auto-opens the access request dialog and supports the back action", async () => {
    const user = userEvent.setup();
    useOptimizedAuthMock.mockReturnValue({
      hasSoundVisionAccess: false,
      isLoading: false,
    });

    renderWithProviders(<SoundVisionFiles />);

    expect(screen.getByText(/acceso restringido/i)).toBeInTheDocument();
    expect(screen.getByText("Dialog open: true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /solicitar acceso/i }));
    expect(screen.getByText("Dialog open: true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /volver/i }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("renders the interactive map for access-enabled users and resolves system dark mode safely", () => {
    useOptimizedAuthMock.mockReturnValue({
      hasSoundVisionAccess: true,
      isLoading: false,
    });
    useThemeMock.mockReturnValue({ theme: "system" });
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as any;

    renderWithProviders(<SoundVisionFiles />);

    expect(screen.getByText("Interactive map dark:true")).toBeInTheDocument();
  });
});
