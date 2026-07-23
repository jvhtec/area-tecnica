// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobCardDocuments } from "@/components/jobs/cards/JobCardDocuments";

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    storage: { from: vi.fn() },
  },
}));

describe("JobCardDocuments", () => {
  it("keeps long filenames and every action inside a stacked mobile row", () => {
    const fileName = "Video_Power_Report_-_Concert_Music_Festival_-_Auditorio.pdf";

    render(
      <JobCardDocuments
        documents={[{
          id: "document-1",
          file_name: fileName,
          file_path: "sound/report.pdf",
          uploaded_at: "2026-06-30T22:30:00Z",
          visible_to_tech: true,
        }]}
        userRole="management"
        onDeleteDocument={vi.fn()}
        showTitle={false}
      />,
    );

    const fileNameElement = screen.getByText(fileName);
    const viewButton = screen.getByRole("button", { name: `Ver ${fileName}` });
    const downloadButton = screen.getByRole("button", { name: `Descargar ${fileName}` });
    const deleteButton = screen.getByRole("button", { name: `Eliminar ${fileName}` });
    const visibilityBadge = screen.getAllByText("Visible para técnicos")[0];
    const uploadDate = screen.getByText("Subido el Jul 1, 2026");
    const actionStrip = viewButton.parentElement;
    const actionArea = actionStrip?.parentElement;
    const row = fileNameElement.parentElement?.parentElement;

    expect(fileNameElement).toHaveClass("[overflow-wrap:anywhere]");
    expect(uploadDate.parentElement).toBe(visibilityBadge.parentElement);
    expect(row).toHaveClass("min-w-0", "max-w-full", "flex-col", "overflow-hidden", "md:flex-row");
    expect(actionArea).toHaveClass("w-full", "items-center", "justify-end", "md:w-auto");
    expect(actionStrip).toHaveClass("flex", "shrink-0", "items-center", "gap-1");
    expect(viewButton).toHaveClass("h-11", "w-11", "shrink-0");
    expect(downloadButton).toHaveClass("h-11", "w-11", "shrink-0");
    expect(deleteButton).toHaveClass("h-11", "w-11", "shrink-0");
  });
});
