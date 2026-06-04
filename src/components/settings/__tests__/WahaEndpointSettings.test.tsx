// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  toastMock,
  useOptimizedAuthMock,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  useOptimizedAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: unknown[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

import { WahaEndpointSettings } from "@/components/settings/WahaEndpointSettings";

describe("WahaEndpointSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    useOptimizedAuthMock.mockReturnValue({
      user: { id: "user-1" },
      userRole: "management",
    });
  });

  it("refreshes WAHA status for the saved endpoint", async () => {
    const user = userEvent.setup();

    mockSupabase.functions.invoke.mockImplementation(async (_name, options) => {
      const action = options?.body?.action;

      if (action === "status") {
        return {
          data: {
            endpoint: "https://waha2.sector-pro.work",
            session: "default",
            status: "WORKING",
            me: { pushName: "Sector Pro" },
          },
          error: null,
        };
      }

      return {
        data: {
          endpoint: "https://waha2.sector-pro.work",
          session: "default",
          status: "UNKNOWN",
          me: null,
        },
        error: null,
      };
    });

    renderWithProviders(<WahaEndpointSettings />);

    expect(await screen.findByText(/WAHA 2 - waha2\.sector-pro\.work/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /actualizar/i }));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("waha-session", {
        body: { action: "status" },
      });
    });

    expect(await screen.findByText("En funcionamiento")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "Cuenta vinculada: Sector Pro")).toBeInTheDocument();
  });

  it("saves a selected WAHA endpoint", async () => {
    const user = userEvent.setup();

    mockSupabase.functions.invoke.mockImplementation(async (_name, options) => {
      const action = options?.body?.action;

      if (action === "save") {
        return {
          data: {
            endpoint: options.body.endpoint,
            session: "default",
            status: "UNKNOWN",
            me: null,
          },
          error: null,
        };
      }

      return {
        data: {
          endpoint: null,
          session: "default",
          status: "NOT_CONFIGURED",
          me: null,
        },
        error: null,
      };
    });

    renderWithProviders(<WahaEndpointSettings />);

    await screen.findByText(/No hay un endpoint WAHA asignado/i);

    await user.click(screen.getByRole("combobox", { name: /endpoint waha/i }));
    await user.click(await screen.findByRole("option", { name: /WAHA 3 - waha3\.sector-pro\.work/i }));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("waha-session", {
        body: {
          action: "save",
          endpoint: "https://waha3.sector-pro.work",
        },
      });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Endpoint WAHA guardado",
      }),
    );
  });

  it("renders the pairing QR returned by the proxy", async () => {
    const user = userEvent.setup();
    const dataUrl = "data:image/png;base64,abc123";

    mockSupabase.functions.invoke.mockImplementation(async (_name, options) => {
      const action = options?.body?.action;

      if (action === "qr") {
        return {
          data: {
            endpoint: "https://waha.sector-pro.work",
            session: "default",
            status: "SCAN_QR_CODE",
            me: null,
            qr: {
              dataUrl,
              mimetype: "image/png",
            },
          },
          error: null,
        };
      }

      return {
        data: {
          endpoint: "https://waha.sector-pro.work",
          session: "default",
          status: "SCAN_QR_CODE",
          me: null,
        },
        error: null,
      };
    });

    renderWithProviders(<WahaEndpointSettings />);

    await screen.findByText(/WAHA 1 - waha\.sector-pro\.work/i);
    await user.click(screen.getByRole("button", { name: "QR" }));

    const qr = await screen.findByRole("img", { name: /codigo qr de emparejamiento waha/i });
    expect(qr).toHaveAttribute("src", dataUrl);
  });
});
