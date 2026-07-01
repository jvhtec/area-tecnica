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

  it("saves a generated WAHA 6 endpoint", async () => {
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
    await user.click(await screen.findByRole("option", { name: /WAHA 6 - waha6\.sector-pro\.work/i }));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("waha-session", {
        body: {
          action: "save",
          endpoint: "https://waha6.sector-pro.work",
        },
      });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Endpoint WAHA guardado",
      }),
    );
  });

  it("shows endpoint directory statuses in the config menu", async () => {
    const user = userEvent.setup();

    mockSupabase.functions.invoke.mockImplementation(async (_name, options) => {
      const action = options?.body?.action;

      if (action === "endpoints") {
        return {
          data: {
            endpoint: "https://waha2.sector-pro.work",
            session: "default",
            status: "UNKNOWN",
            me: null,
            endpoints: [
              {
                label: "WAHA 2",
                value: "https://waha2.sector-pro.work",
                session: "default",
                status: "WORKING",
                me: { pushName: "Sector Pro" },
              },
              {
                label: "WAHA 6",
                value: "https://waha6.sector-pro.work",
                session: "default",
                status: "STOPPED",
                me: null,
              },
            ],
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

    expect(await screen.findByText("Estado de endpoints")).toBeInTheDocument();
    expect(await screen.findByText("waha6.sector-pro.work")).toBeInTheDocument();
    expect(screen.getByText("Detenida")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /endpoint waha/i }));
    expect(await screen.findByRole("option", { name: /WAHA 6 - waha6\.sector-pro\.work/i })).toBeInTheDocument();
  });

  it("restarts the saved WAHA session", async () => {
    const user = userEvent.setup();

    mockSupabase.functions.invoke.mockImplementation(async (_name, options) => {
      const action = options?.body?.action;

      if (action === "restart") {
        return {
          data: {
            endpoint: "https://waha.sector-pro.work",
            session: "default",
            status: "WORKING",
            me: { pushName: "Sector Pro" },
          },
          error: null,
        };
      }

      return {
        data: {
          endpoint: "https://waha.sector-pro.work",
          session: "default",
          status: "FAILED",
          me: null,
        },
        error: null,
      };
    });

    renderWithProviders(<WahaEndpointSettings />);

    await screen.findByText(/WAHA 1 - waha\.sector-pro\.work/i);
    await user.click(screen.getByRole("button", { name: /reiniciar/i }));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("waha-session", {
        body: { action: "restart" },
      });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sesion WAHA reiniciada",
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
