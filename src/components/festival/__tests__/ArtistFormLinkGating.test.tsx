import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ArtistActionButtons } from "@/components/festival/ArtistActionButtons";
import { ArtistTableHeader } from "@/components/festival/ArtistTableHeader";
import { canManageArtistFormLinks } from "@/utils/permissions";

const artist = {
  id: "artist-1",
  name: "Alpha",
  date: "2031-07-10",
  show_start: "20:00",
  show_end: "21:00",
};

const renderActions = (canManageFormLinks?: boolean) =>
  render(
    <ArtistActionButtons
      artist={artist}
      printingArtistId={null}
      uploadingStagePlotArtistId={null}
      deletingStagePlotArtistId={null}
      deletingArtistId={null}
      canDelete={false}
      canCreateExtras={false}
      canManageFormLinks={canManageFormLinks}
      isCreatingExtrasFor={() => false}
      onGenerateLink={vi.fn()}
      onManageFiles={vi.fn()}
      onPrintArtist={vi.fn()}
      onOpenStagePlotCapture={vi.fn()}
      onDeleteStagePlot={vi.fn()}
      onEditArtist={vi.fn()}
      onDeleteArtist={vi.fn()}
      onCreateFlexExtras={vi.fn()}
    />,
  );

describe("public artist form link gating", () => {
  it("limits form links to the roles that may read their tokens", () => {
    expect(canManageArtistFormLinks("admin")).toBe(true);
    expect(canManageArtistFormLinks("management")).toBe(true);
    expect(canManageArtistFormLinks("logistics")).toBe(true);
    expect(canManageArtistFormLinks("house_tech")).toBe(false);
    expect(canManageArtistFormLinks("technician")).toBe(false);
    expect(canManageArtistFormLinks(null)).toBe(false);
  });

  it("hides the generate-link action unless allowed", async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByTitle("Más acciones"));
    expect(screen.queryByText("Generar enlace de formulario")).not.toBeInTheDocument();
    expect(screen.getByText("Gestionar archivos/riders")).toBeInTheDocument();
  });

  it("shows the generate-link action to managers", async () => {
    const user = userEvent.setup();
    renderActions(true);
    await user.click(screen.getByTitle("Más acciones"));
    expect(screen.getByText("Generar enlace de formulario")).toBeInTheDocument();
  });

  it("shows the links list button only to managers", () => {
    const { rerender } = render(
      <ArtistTableHeader artistCount={2} canManageFormLinks={false} onViewLinks={vi.fn()} />,
    );
    expect(screen.getByText("Cronograma de artistas (2 artistas)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver todos los enlaces/i })).not.toBeInTheDocument();

    rerender(<ArtistTableHeader artistCount={2} canManageFormLinks onViewLinks={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /ver todos los enlaces/i })).toHaveLength(2);
  });
});
