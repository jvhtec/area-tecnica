import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstructuraSourceDepartment } from "@/domain/estructura";

const mocks = vi.hoisted(() => ({
  reconcileFolders: vi.fn(),
  resolveTargets: vi.fn(),
  pushQuantities: vi.fn(),
}));

vi.mock("@/services/estructuraMotorPreparation", async () => {
  const actual = await vi.importActual("@/services/estructuraMotorPreparation");
  return {
    ...actual,
    reconcileEstructuraFoldersForJob: mocks.reconcileFolders,
    resolveEstructuraPullSheetTargets: mocks.resolveTargets,
    pushEstructuraMotorQuantities: mocks.pushQuantities,
  };
});

import { PrepareMotorsAction } from "../PrepareMotorsAction";

const renderAction = (department: EstructuraSourceDepartment = "sound") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PrepareMotorsAction department={department} jobId="job-1" />
    </QueryClientProvider>,
  );
};

describe("PrepareMotorsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTargets.mockResolvedValue({
      targets: {
        sound: { id: "sound-row", elementId: "sound-ps", sourceDepartment: "sound" },
        lights: { id: "lights-row", elementId: "lights-ps", sourceDepartment: "lights" },
      },
      missing: [],
    });
    mocks.pushQuantities.mockResolvedValue({
      sound: { status: "success", requestedQuantity: 1, message: "Flex añadió 1 motor." },
      lights: { status: "skipped", requestedQuantity: 0, message: "Sin motores." },
    });
    mocks.reconcileFolders.mockResolvedValue({ targets: {}, missing: [] });
  });

  it.each([
    ["sound", "Sonido", "Luces"],
    ["lights", "Luces", "Sonido"],
  ] as const)("shows only the %s destination catalog", async (department, label, otherLabel) => {
    renderAction(department);
    const trigger = screen.getByRole("button", { name: "Motores" });
    expect(trigger).not.toHaveClass("min-h-11");
    fireEvent.click(trigger);

    expect(await screen.findByRole("heading", { name: "Preparar motores y controles" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: `Motores y controles para ${label}` })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: otherLabel })).not.toBeInTheDocument();
    expect(screen.getByText("ChainMaster 1Tn D8+")).toBeInTheDocument();
    expect(screen.getByText("Control Motor Briteq 8uni")).toBeInTheDocument();
    expect(screen.getByText(/Este envío añadirá material/)).toBeInTheDocument();
    expect(screen.getByText(/Repetir el envío puede duplicar cantidades/)).toBeInTheDocument();
  });

  it("submits only the current department and sends zero rows for the other destination", async () => {
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));
    await screen.findByRole("heading", { name: "Preparar motores y controles" });

    fireEvent.click(screen.getByRole("button", {
      name: "Sumar Motor eléctrico de elevación 250 kg - 20 m a Sonido",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir 1 unidad" }));

    await waitFor(() => expect(mocks.pushQuantities).toHaveBeenCalledTimes(1));
    const selections = mocks.pushQuantities.mock.calls[0][1];
    expect(selections.sound[0]).toMatchObject({ quantity: 1 });
    expect(selections.lights.every((selection: { quantity: number }) => selection.quantity === 0)).toBe(true);
    expect(await screen.findByText(/Flex añadió 1 motor/)).toBeInTheDocument();
  });

  it("shows a clear missing-target recovery action", async () => {
    mocks.resolveTargets
      .mockResolvedValueOnce({
        targets: { lights: { id: "lights-row", elementId: "lights-ps", sourceDepartment: "lights" } },
        missing: ["sound"],
      })
      .mockResolvedValue({
        targets: {
          sound: { id: "sound-row", elementId: "sound-ps", sourceDepartment: "sound" },
          lights: { id: "lights-row", elementId: "lights-ps", sourceDepartment: "lights" },
        },
        missing: [],
      });
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));

    expect(await screen.findByText(/Falta el Pull Sheet de Estructura de Sonido/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear Estructura y Pull Sheets" }));
    await waitFor(() => expect(mocks.reconcileFolders).toHaveBeenCalledWith("job-1"));
    expect(await screen.findByRole("status")).toHaveTextContent(/ya están disponibles/);
  });

  it("uses mobile-safe viewport sizing and touch targets", async () => {
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("w-[calc(100vw-1rem)]");
    expect(dialog.className).toContain("safe-area-inset-bottom");
    expect(dialog.className).toContain("safe-area-inset-left");
    expect(dialog.className).toContain("[&>button]:h-11");
    expect(screen.getByRole("button", {
      name: "Sumar Motor eléctrico de elevación 250 kg - 20 m a Sonido",
    })).toHaveClass("h-11", "w-11");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass("min-h-11", "w-full");
  });

  it("shows only the current department outcome after a partial push", async () => {
    mocks.pushQuantities.mockResolvedValue({
      sound: { status: "success", requestedQuantity: 1, message: "Flex añadió 1 motor al Pull Sheet." },
      lights: { status: "error", requestedQuantity: 1, message: "Flex Luces no disponible." },
    });
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));
    await screen.findByRole("heading", { name: "Preparar motores y controles" });

    fireEvent.click(screen.getByRole("button", {
      name: "Sumar Motor eléctrico de elevación 250 kg - 20 m a Sonido",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir 1 unidad" }));

    await waitFor(() => expect(mocks.pushQuantities).toHaveBeenCalledTimes(1));
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent === "Sonido: Flex añadió 1 motor al Pull Sheet.",
    )).toBeInTheDocument();
    expect(screen.queryByText(/Flex Luces no disponible/)).not.toBeInTheDocument();
  });
});
