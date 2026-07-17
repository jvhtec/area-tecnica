import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MotorCertificateAction } from "@/components/jobs/cards/job-card-actions/MotorCertificateAction";
import { fetchFlexMotorUnits } from "@/services/flexMotorUnits";
import { generateMotorInspectionCertificates } from "@/utils/pdf/motorInspectionCertificates";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/flexMotorUnits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/flexMotorUnits")>();
  return { ...actual, fetchFlexMotorUnits: vi.fn() };
});

vi.mock("@/utils/pdf/motorInspectionCertificates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/pdf/motorInspectionCertificates")>();
  return { ...actual, generateMotorInspectionCertificates: vi.fn() };
});

const fetchMock = vi.mocked(fetchFlexMotorUnits);
const generateMock = vi.mocked(generateMotorInspectionCertificates);

const renderAction = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MotorCertificateAction job={{ id: "job-1", title: "Gira Norte", job_type: "single" } as never} />
    </QueryClientProvider>,
  );
};

describe("MotorCertificateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      units: [
        {
          id: "unit-1",
          modelId: "model-1",
          modelName: "LIFTKET STAR 500 kg",
          manufacturer: "LIFTKET",
          serial: "SERIE-1",
          barcode: "BAR-1",
          stencil: null,
          modelNumber: null,
          currentLocation: "Almacén",
          shippedDate: null,
          returnDate: null,
        },
        {
          id: "unit-2",
          modelId: "model-1",
          modelName: "LIFTKET STAR 500 kg",
          manufacturer: "LIFTKET",
          serial: "SERIE-2",
          barcode: "BAR-2",
          stencil: null,
          modelNumber: null,
          currentLocation: "Almacén",
          shippedDate: null,
          returnDate: null,
        },
      ],
      modelErrors: [],
      manifest: {
        status: "found",
        unitIds: ["unit-1"],
        sources: [{
          equipmentListId: "list-1",
          equipmentListName: "Material sonido",
          manifestId: "manifest-1",
          stage: "ship",
        }],
        message: "1 motor encontrado en el manifiesto del trabajo.",
        warnings: [],
      },
    });
    generateMock.mockResolvedValue({
      blob: new Blob(["pdf"], { type: "application/pdf" }),
      filename: "Certificados de motores - Gira Norte.pdf",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:motor-certificates"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("preselects manifest motors and keeps manual additions available", async () => {
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Certificados de motores" }));
    expect(await screen.findByText("SERIE-1")).toBeInTheDocument();
    expect(screen.queryByText("SERIE-2")).not.toBeInTheDocument();
    expect(screen.getByText("1 motor seleccionado")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Desde el manifiesto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Selección manual" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Selección manual" }));
    expect(screen.getByRole("button", { name: "Desde el manifiesto" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Selección manual" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("SERIE-2")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar motor SERIE-2" }));
    await user.click(screen.getByRole("button", { name: "Generar 2 certificados" }));

    await waitFor(() => expect(generateMock).toHaveBeenCalledWith({
      units: expect.arrayContaining([
        expect.objectContaining({ serial: "SERIE-1", manufacturer: "LIFTKET" }),
        expect.objectContaining({ serial: "SERIE-2", manufacturer: "LIFTKET" }),
      ]),
      jobName: "Gira Norte",
    }));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Certificados descargados",
    }));
    expect(window.open).not.toHaveBeenCalled();
  });
});
