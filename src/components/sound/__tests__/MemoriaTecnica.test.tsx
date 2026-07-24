// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

const {
  createSignedUrlMock,
  invokeMock,
  toastMock,
  upsertMemoriaTecnicaDocumentMock,
  useMemoriaAutoFillMock,
  useMemoriaJobAndStageMock,
} = vi.hoisted(() => ({
  createSignedUrlMock: vi.fn(),
  invokeMock: vi.fn(),
  toastMock: vi.fn(),
  upsertMemoriaTecnicaDocumentMock: vi.fn(),
  useMemoriaAutoFillMock: vi.fn(),
  useMemoriaJobAndStageMock: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    functions: { invoke: invokeMock },
    storage: {
      from: () => ({ createSignedUrl: createSignedUrlMock }),
    },
  },
}));

vi.mock("@/hooks/useLogoOptions", () => ({
  useLogoOptions: () => ({
    isLoading: false,
    logoOptions: [] as Array<{ label: string; url: string; value: string }>,
  }),
}));

vi.mock("@/features/technical-tools/memoria/useMemoriaJobAndStage", () => ({
  useMemoriaJobAndStage: () => useMemoriaJobAndStageMock(),
}));

vi.mock("@/features/technical-tools/memoria/useMemoriaAutoFill", () => ({
  useMemoriaAutoFill: () => useMemoriaAutoFillMock(),
}));

vi.mock("@/features/technical-tools/memoria/MemoriaDetectedDocumentSelect", () => ({
  MemoriaDetectedDocumentSelect: (): null => null,
}));

vi.mock("@/features/technical-tools/stage/stageAllocation", () => ({
  TechnicalStageSelector: (): null => null,
}));

vi.mock("@/features/technical-tools/jobs/DocumentationJobPicker", () => ({
  DocumentationJobPicker: (): null => null,
}));

vi.mock("@/utils/memoriaTecnicaDocuments", () => ({
  upsertMemoriaTecnicaDocument: (...args: unknown[]) =>
    upsertMemoriaTecnicaDocumentMock(...args),
}));

vi.mock("@/utils/flexMaterialReport", () => ({
  fetchFlexMaterialReport: vi.fn(),
}));

vi.mock("@/utils/storageUpload", () => ({
  isStorageNotFoundError: () => false,
  uploadStorageObject: vi.fn(),
}));

import { MemoriaTecnica } from "../MemoriaTecnica";

describe("MemoriaTecnica", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    useMemoriaJobAndStageMock.mockReturnValue({
      hasMultipleStages: false,
      isLoadingJobs: false,
      isLoadingStages: false,
      jobIdFromUrl: "job-1",
      jobs: [],
      selectedJob: { id: "job-1", title: "KBS Music Bank" },
      selectedJobId: "job-1",
      selectedStage: null,
      selectedStageNumber: null,
      setSelectedJobId: vi.fn(),
      setSelectedStageNumber: vi.fn(),
      stages: [],
    });
    useMemoriaAutoFillMock.mockReturnValue({
      candidates: {
        material: [{
          fileName: "material.pdf",
          filePath: "calculators/lista-material/sound/job-1/material.pdf",
          uploadedAt: "2026-07-24T08:45:34.000Z",
        }],
      },
      detected: {
        material: {
          fileName: "material.pdf",
          filePath: "calculators/lista-material/sound/job-1/material.pdf",
          uploadedAt: "2026-07-24T08:45:34.000Z",
        },
      },
      isLoading: false,
      refetch: vi.fn(),
      selectDocument: vi.fn(),
    });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://project.supabase.co/storage/v1/object/sign/job-documents/material.pdf?token=test" },
      error: null,
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("shows the Spanish Edge Function error body in the failure toast", async () => {
    const user = userEvent.setup();
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({
          code: "source_too_large",
          error: "El documento «Informe SoundVision» supera el límite de 20 MB",
        })),
        message: "Edge Function returned a non-2xx status code",
      },
    });

    renderWithProviders(<MemoriaTecnica />);

    await waitFor(() => {
      expect(screen.getByLabelText("Nombre del Proyecto")).toHaveValue("KBS Music Bank");
    });
    await user.click(screen.getByRole("button", { name: "Generar Memoria Técnica" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error",
        description: "El documento «Informe SoundVision» supera el límite de 20 MB",
        variant: "destructive",
      });
    });
    expect(upsertMemoriaTecnicaDocumentMock).not.toHaveBeenCalled();
  });
});
