import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchPublicArtistFormContext,
  fetchBlankFormContext,
  fetchJobStageNames,
  resolveFestivalLogoUrl,
  toast,
} = vi.hoisted(() => ({
  fetchPublicArtistFormContext: vi.fn(),
  fetchBlankFormContext: vi.fn(),
  fetchJobStageNames: vi.fn(),
  resolveFestivalLogoUrl: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/features/festival-forms/api", () => ({
  fetchPublicArtistFormContext,
  fetchBlankFormContext,
  fetchJobStageNames,
  resolveFestivalLogoUrl,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/festival/usePublicArtistFormSubmit", () => ({
  usePublicArtistFormSubmit: () => ({
    handleSubmit: vi.fn(),
    isSubmitting: false,
  }),
}));

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { ArtistRequirementsForm } from "../ArtistRequirementsForm";

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderForm = (path: string, isBlank = false) =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/festival/artist-form/:token"
            element={<ArtistRequirementsForm isBlank={isBlank} />}
          />
          <Route
            path="/festival/artist-form-blank"
            element={<ArtistRequirementsForm isBlank />}
          />
          <Route path="/festival/form-submitted" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ArtistRequirementsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveFestivalLogoUrl.mockResolvedValue(null);
    fetchJobStageNames.mockResolvedValue([]);
  });

  it("loads the artist's pre-filled record, tells the artist some fields are locked, and shows the rider section", async () => {
    fetchPublicArtistFormContext.mockResolvedValue({
      ok: true,
      artist: {
        id: "a1",
        job_id: "j1",
        name: "Los Planetas",
        stage: 1,
        date: "2026-07-10",
        rider_missing: true,
      },
      rider_files: [],
      stage_names: [{ number: 1, name: "Main" }],
    });
    renderForm("/festival/artist-form/tok-1");

    expect(
      await screen.findByText(
        "Algunos campos fueron pre-cargados por producción y están bloqueados.",
      ),
    ).toBeInTheDocument();
    expect(fetchPublicArtistFormContext).toHaveBeenCalledWith("tok-1");
    expect(screen.getByText("Rider Técnico")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No hay ningún rider cargado actualmente para este artista.",
      ),
    ).toBeInTheDocument();
    // Stage names came with the context, so no second lookup.
    expect(fetchJobStageNames).not.toHaveBeenCalled();
  });

  it("looks stage names up by job when the context carries none", async () => {
    fetchPublicArtistFormContext.mockResolvedValue({
      ok: true,
      artist: { id: "a1", job_id: "j1" },
      stage_names: [],
    });
    fetchJobStageNames.mockResolvedValue([{ number: 1, name: "Club" }]);
    renderForm("/festival/artist-form/tok-1");
    await waitFor(() => expect(fetchJobStageNames).toHaveBeenCalledWith("j1"));
  });

  it("sends an already-submitted form to the thank-you page in the form's language", async () => {
    fetchPublicArtistFormContext.mockResolvedValue({
      ok: false,
      status: "submitted",
    });
    renderForm("/festival/artist-form/tok-1?lang=en");
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/festival/form-submitted",
    );
  });

  it("explains an expired link instead of showing the form", async () => {
    fetchPublicArtistFormContext.mockResolvedValue({
      ok: false,
      status: "expired",
    });
    renderForm("/festival/artist-form/tok-1");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Formulario no disponible",
          description: "Este enlace de formulario ha expirado.",
        }),
      ),
    );
  });

  it("reports a failed load without crashing", async () => {
    fetchPublicArtistFormContext.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderForm("/festival/artist-form/tok-1");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "No se pudieron cargar los datos del formulario.",
        }),
      ),
    );
  });

  it("blank mode loads the festival's gear and stages, never the artist RPC, and has no submit button", async () => {
    fetchBlankFormContext.mockResolvedValue({
      gearData: null,
      stages: [{ number: 1, name: "Main" }],
      logoPath: "logo.png",
    });
    resolveFestivalLogoUrl.mockResolvedValue("https://cdn/logo.png");
    renderForm("/festival/artist-form-blank?jobId=j9&date=2026-07-11");

    await waitFor(() =>
      expect(fetchBlankFormContext).toHaveBeenCalledWith("j9"),
    );
    expect(fetchPublicArtistFormContext).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("img", { name: "Festival Logo" }),
    ).toHaveAttribute("src", "https://cdn/logo.png");
    expect(screen.queryByText("Enviar Requerimientos")).not.toBeInTheDocument();
    expect(
      screen.getByText("Imprimir Formulario en Blanco"),
    ).toBeInTheDocument();
  });
});
