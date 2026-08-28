import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTargets: vi.fn(),
  pushQuantities: vi.fn(),
}));

vi.mock("@/services/estructuraMotorPreparation", async () => {
  const actual = await vi.importActual("@/services/estructuraMotorPreparation");
  return {
    ...actual,
    resolveEstructuraPullSheetTargets: mocks.resolveTargets,
    pushEstructuraMotorQuantities: mocks.pushQuantities,
  };
});

import { PrepareMotorsAction } from "../PrepareMotorsAction";

const renderAction = (onCreateFlexFolders?: () => void) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PrepareMotorsAction jobId="job-1" onCreateFlexFolders={onCreateFlexFolders} />
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
    const createFolders = vi.fn();
    mocks.resolveTargets.mockResolvedValue({
      targets: { sound: { id: "sound-row", elementId: "sound-ps", sourceDepartment: "sound" } },
      missing: ["lights"],
    });
    renderAction(createFolders);
    fireEvent.click(screen.getByRole("button", { name: "Motores" }));

    expect(await screen.findByText(/Faltan los Pull Sheets de Estructura de Luces/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear o reconciliar carpetas Flex" }));
    expect(createFolders).toHaveBeenCalledTimes(1);
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
