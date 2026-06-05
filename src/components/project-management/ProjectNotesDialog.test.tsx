// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectNotesDialog } from "./ProjectNotesDialog";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

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
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
    mockUpsert.mockReset();
    mockFrom.mockReset();

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValue({
      data: {
        job_id: "job-1",
        notes: "Initial note",
        updated_at: "2026-06-05T09:30:00.000Z",
        updated_by: "user-1",
      },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      upsert: mockUpsert,
    });
  });

  it("does not mount the notepad when the user lacks management permissions", () => {
    renderDialog({ canManageNotes: false });

    expect(screen.queryByText("Notas de produccion")).not.toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("loads and saves the job project note", async () => {
    const { onOpenChange } = renderDialog();

    const textarea = await screen.findByRole("textbox", { name: "Notas de produccion" });
    await waitFor(() => expect(textarea).toHaveValue("Initial note"));

    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Updated production note");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          job_id: "job-1",
          notes: "Updated production note",
          updated_by: "user-1",
        },
        { onConflict: "job_id" },
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
