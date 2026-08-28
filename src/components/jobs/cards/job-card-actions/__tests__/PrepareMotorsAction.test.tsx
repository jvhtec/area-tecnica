import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const renderAction = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PrepareMotorsAction jobId="job-1" />
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

  it("renders approved models for both destinations and shows the additive warning", async () => {
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));

    expect(await screen.findByRole("heading", { name: "Preparar motores" })).toBeInTheDocument();
    expect(screen.getAllByText("Motor eléctrico de elevación 250 kg - 20 m")).toHaveLength(2);
    expect(screen.getByText(/Este envío añadirá material/)).toBeInTheDocument();
    expect(screen.getByText(/Repetir el envío puede duplicar cantidades/)).toBeInTheDocument();
  });

  it("keeps Sound and Lights quantities independent and sends zero rows as zero", async () => {
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));
    await screen.findByRole("heading", { name: "Preparar motores" });

    fireEvent.click(screen.getByRole("button", {
      name: "Sumar Motor eléctrico de elevación 250 kg - 20 m a Sonido",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir 1 motor" }));

    await waitFor(() => expect(mocks.pushQuantities).toHaveBeenCalledTimes(1));
    const selections = mocks.pushQuantities.mock.calls[0][1];
    expect(selections.sound[0]).toMatchObject({ quantity: 1 });
    expect(selections.lights.every((selection: { quantity: number }) => selection.quantity === 0)).toBe(true);
    expect(await screen.findByText(/Flex añadió 1 motor/)).toBeInTheDocument();
  });

  it("shows a clear missing-target recovery action", async () => {
    mocks.resolveTargets
      .mockResolvedValueOnce({
        targets: { sound: { id: "sound-row", elementId: "sound-ps", sourceDepartment: "sound" } },
        missing: ["lights"],
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

    expect(await screen.findByText(/Faltan los Pull Sheets de Estructura de Luces/)).toBeInTheDocument();
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

  it("shows Sound and Lights outcomes independently after a partial push", async () => {
    mocks.pushQuantities.mockResolvedValue({
      sound: { status: "success", requestedQuantity: 1, message: "Flex añadió 1 motor al Pull Sheet." },
      lights: { status: "error", requestedQuantity: 1, message: "Flex Luces no disponible." },
    });
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));
    await screen.findByRole("heading", { name: "Preparar motores" });

    fireEvent.click(screen.getByRole("button", {
      name: "Sumar Motor eléctrico de elevación 250 kg - 20 m a Sonido",
    }));
    fireEvent.click(screen.getByRole("button", {
      name: "Sumar Motor eléctrico de elevación 250 kg - 20 m a Luces",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir 2 motores" }));

    await waitFor(() => expect(mocks.pushQuantities).toHaveBeenCalledTimes(1));
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent === "Sonido: Flex añadió 1 motor al Pull Sheet.",
    )).toBeInTheDocument();
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent === "Luces: Flex Luces no disponible.",
    )).toBeInTheDocument();
  });
});
