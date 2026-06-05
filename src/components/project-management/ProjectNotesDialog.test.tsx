// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectNotesDialog } from "./ProjectNotesDialog";
import { getJobProjectNote, saveJobProjectNote } from "@/services/projectNotesService";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/services/projectNotesService", () => ({
  getJobProjectNote: vi.fn(),
  saveJobProjectNote: vi.fn(),
}));

const mockGetJobProjectNote = vi.mocked(getJobProjectNote);
const mockSaveJobProjectNote = vi.mocked(saveJobProjectNote);

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderDialog = (props?: Partial<React.ComponentProps<typeof ProjectNotesDialog>>) => {
  const queryClient = createQueryClient();
  const onOpenChange = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <ProjectNotesDialog
        open
        onOpenChange={onOpenChange}
        jobId="job-1"
        jobTitle="Test Job"
        canManageNotes
        {...props}
      />
    </QueryClientProvider>,
  );

  return { onOpenChange };
};

describe("ProjectNotesDialog", () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockGetJobProjectNote.mockReset();
    mockSaveJobProjectNote.mockReset();

    mockGetJobProjectNote.mockResolvedValue({
      job_id: "job-1",
      notes: "Initial note",
      updated_at: "2026-06-05T09:30:00.000Z",
      updated_by: "user-1",
    });
    mockSaveJobProjectNote.mockResolvedValue(undefined);
  });

  it("does not mount the notepad when the user lacks management permissions", () => {
    renderDialog({ canManageNotes: false });

    expect(screen.queryByText("Notas de produccion")).not.toBeInTheDocument();
    expect(mockGetJobProjectNote).not.toHaveBeenCalled();
  });

  it("loads and saves the job project note", async () => {
    const { onOpenChange } = renderDialog();

    const textarea = await screen.findByRole("textbox", { name: "Notas de produccion" });
    await waitFor(() => expect(textarea).toHaveValue("Initial note"));

    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Updated production note");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockSaveJobProjectNote).toHaveBeenCalledWith("job-1", "Updated production note");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
