import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { backlogMock, issuesMock, retryMock } = vi.hoisted(() => ({
  backlogMock: vi.fn(),
  issuesMock: vi.fn(),
  retryMock: vi.fn(),
}));

vi.mock("@/features/assignments/commands", () => ({
  fetchAssignmentSideEffectBacklog: backlogMock,
  fetchAssignmentConsistencyIssues: issuesMock,
  retryAssignmentSideEffects: retryMock,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AssignmentReconciliationPanel } from "../AssignmentReconciliationPanel";

const renderPanel = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AssignmentReconciliationPanel />
  </QueryClientProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  backlogMock.mockResolvedValue([{
    command_id: "cmd-1", command_type: "apply_direct_assignment", job_id: "job-1", technician_id: "tech-1",
    source: "assignment-dialog", side_effects_status: "failed", created_at: "2026-10-03T10:00:00Z",
    side_effects: [{ kind: "flex", action: "add", job_id: "job-1", department: "sound", status: "failed", last_error: "Flex down" }],
  }]);
  issuesMock.mockResolvedValue([
    { issue: "membership_without_schedule", job_id: "job-2", technician_id: "tech-2", details: {} },
  ]);
  retryMock.mockResolvedValue({ attempted: 1, failed: 0, recorded: true });
});

describe("AssignmentReconciliationPanel", () => {
  it("lists failed side effects and retries them", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText(/Flex \(añadir a sonido\): error \(Flex down\)/)).toBeInTheDocument();
    expect(screen.getByText("Asignación sin días activos: 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(retryMock).toHaveBeenCalledWith("cmd-1"));
    await waitFor(() => expect(backlogMock).toHaveBeenCalledTimes(2));
  });

  it("states when there is nothing to reconcile", async () => {
    backlogMock.mockResolvedValue([]);
    issuesMock.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText("No hay sincronizaciones pendientes.")).toBeInTheDocument();
    expect(await screen.findByText("Sin incoherencias detectadas.")).toBeInTheDocument();
  });
});
