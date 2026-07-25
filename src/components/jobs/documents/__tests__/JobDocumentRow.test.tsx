// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobDocumentRow } from "@/components/jobs/documents/JobDocumentRow";

const documentFixture = {
  id: "document-1",
  file_name: "Memoria técnica de sonido.pdf",
  file_path: "sound/memoria.pdf",
  uploaded_at: "2026-07-21T10:00:00Z",
  visible_to_tech: true,
};

describe("JobDocumentRow", () => {
  it("keeps view and download actions in a full-width mobile action row", () => {
    const onView = vi.fn();
    const onDownload = vi.fn();

    render(
      <JobDocumentRow
        doc={documentFixture}
        isLoading={false}
        onView={onView}
        onDownload={onDownload}
      />,
    );

    const viewButton = screen.getByRole("button", { name: `Ver ${documentFixture.file_name}` });
    const downloadButton = screen.getByRole("button", { name: `Descargar ${documentFixture.file_name}` });
    const actionRow = viewButton.parentElement;

    expect(actionRow).toHaveClass("grid", "w-full", "grid-cols-2", "md:flex", "md:w-auto");
    expect(viewButton).toHaveClass("min-h-11", "w-full");
    expect(downloadButton).toHaveClass("min-h-11", "w-full");

    fireEvent.click(viewButton);
    fireEvent.click(downloadButton);
    expect(onView).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("adds a third column and delete action when onDelete is provided", () => {
    const onDelete = vi.fn();

    render(
      <JobDocumentRow
        doc={documentFixture}
        isLoading={false}
        onView={() => {}}
        onDownload={() => {}}
        onDelete={onDelete}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: `Eliminar ${documentFixture.file_name}` });
    expect(deleteButton.parentElement).toHaveClass("grid-cols-3");

    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
