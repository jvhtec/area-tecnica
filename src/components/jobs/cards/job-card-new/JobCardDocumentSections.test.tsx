// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { JobCardDocumentSections } from "./JobCardDocumentSections";

vi.mock("../JobCardDocuments", () => ({
  JobCardDocuments: ({ documents }: { documents: Array<{ file_name: string }> }) => (
    <div>{documents.map((document) => document.file_name).join(", ")}</div>
  ),
}));

const tourDocument = {
  id: "tour-document",
  file_name: "tour.pdf",
  file_path: "tour/tour.pdf",
  uploaded_at: "2026-07-20T23:30:00.000Z",
};

const riderDocument = {
  id: "rider-document",
  file_name: "rider.pdf",
  file_path: "riders/rider.pdf",
  uploaded_at: "2026-07-20T11:00:00.000Z",
  artist_id: "artist-1",
};

function Harness({
  jobType = "single",
  onViewRider = vi.fn(),
  onDownloadRider = vi.fn(),
}: {
  jobType?: string;
  onViewRider?: ReturnType<typeof vi.fn>;
  onDownloadRider?: ReturnType<typeof vi.fn>;
}) {
  const [documentsCollapsed, setDocumentsCollapsed] = useState(false);
  const [tourDocumentsCollapsed, setTourDocumentsCollapsed] = useState(false);
  const [ridersCollapsed, setRidersCollapsed] = useState(false);

  return (
    <JobCardDocumentSections
      jobType={jobType}
      userRole="management"
      documents={[
        {
          id: "job-document",
          file_name: "job.pdf",
          file_path: "jobs/job.pdf",
          uploaded_at: "2026-07-20T09:00:00.000Z",
        },
      ]}
      documentsCollapsed={documentsCollapsed}
      setDocumentsCollapsed={setDocumentsCollapsed}
      onDeleteDocument={vi.fn()}
      tourDocuments={[tourDocument]}
      tourDocumentsCollapsed={tourDocumentsCollapsed}
      setTourDocumentsCollapsed={setTourDocumentsCollapsed}
      onViewTourDocument={vi.fn()}
      onDownloadTourDocument={vi.fn()}
      riderFiles={[riderDocument]}
      artistNameMap={new Map([["artist-1", "Banda Uno"]])}
      ridersCollapsed={ridersCollapsed}
      setRidersCollapsed={setRidersCollapsed}
      onViewRider={onViewRider}
      onDownloadRider={onDownloadRider}
    />
  );
}

describe("JobCardDocumentSections", () => {
  it("preserves collapsible job, tour, and artist document groups", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("job.pdf")).toBeInTheDocument();
    expect(screen.getByText("tour.pdf")).toBeInTheDocument();
    expect(screen.getByText("Jul 21, 2026")).toBeInTheDocument();
    expect(screen.getByText("rider.pdf")).toBeInTheDocument();
    expect(screen.getByText("Artist: Banda Uno")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tour Documents (1)" }));
    expect(screen.queryByText("tour.pdf")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tour Documents (1)" }));
    expect(screen.getByText("tour.pdf")).toBeInTheDocument();
  });

  it("keeps rider view and download callbacks connected", async () => {
    const user = userEvent.setup();
    const onViewRider = vi.fn();
    const onDownloadRider = vi.fn();
    render(<Harness onViewRider={onViewRider} onDownloadRider={onDownloadRider} />);

    const viewButtons = screen.getAllByTitle("View");
    const downloadButtons = screen.getAllByTitle("Download");
    await user.click(viewButtons[1]);
    await user.click(downloadButtons[1]);

    expect(onViewRider).toHaveBeenCalledWith(riderDocument);
    expect(onDownloadRider).toHaveBeenCalledWith(riderDocument);
  });

  it("renders no document groups for dryhire jobs", () => {
    render(<Harness jobType="dryhire" />);

    expect(screen.queryByText("job.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("tour.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("rider.pdf")).not.toBeInTheDocument();
  });
});
