// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ProjectManagement from "../ProjectManagement";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseOptimizedAuth = vi.fn();
vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: () => mockUseOptimizedAuth(),
}));

const mockUseOptimizedJobs = vi.fn();
vi.mock("@/hooks/useOptimizedJobs", () => ({
  useOptimizedJobs: (...args: unknown[]) => mockUseOptimizedJobs(...args),
}));

const mockUseSetupJob = vi.fn();
const focusedSetupJob = {
  id: "job-1",
  title: "Focused setup job",
  start_time: "2026-11-12T08:00:00.000Z",
  job_departments: [{ department: "lights" }],
};
vi.mock("@/features/setup-workflows/jobContext", () => ({
  useSetupJob: (...args: unknown[]) => mockUseSetupJob(...args),
}));

vi.mock("@/hooks/useTabVisibility", () => ({
  useTabVisibility: () => {},
}));

const mockForceSubscribe = vi.fn();
vi.mock("@/providers/SubscriptionProvider", () => ({
  useSubscriptionContext: () => ({
    forceSubscribe: mockForceSubscribe,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

let mockIsMobile = false;
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

vi.mock("@/components/project-management/MonthNavigation", () => ({
  MonthNavigation: () => <div data-testid="month-navigation" />,
}));

vi.mock("@/components/project-management/JobTypeFilter", () => ({
  JobTypeFilter: () => <div data-testid="job-type-filter" />,
}));

vi.mock("@/components/project-management/StatusFilter", () => ({
  StatusFilter: () => <div data-testid="status-filter" />,
}));

vi.mock("@/components/jobs/cards/JobCardNew", () => ({
  JobCardNew: ({ job }: { job: { id: string; title: string } }) => (
    <div data-testid={`job-card-${job?.id ?? "unknown"}`}>{job?.title ?? "Unknown"}</div>
  ),
}));

const mockAutoCompleteJobs = vi.fn().mockResolvedValue({ updatedJobs: [], updatedCount: 0 });
vi.mock("@/utils/jobStatusUtils", () => ({
  autoCompleteJobs: (...args: unknown[]) => mockAutoCompleteJobs(...args),
}));

const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("ProjectManagement department tabs", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockForceSubscribe.mockReset();
    mockUseOptimizedAuth.mockReset();
    mockUseOptimizedJobs.mockReset();
    mockUseSetupJob.mockReset();
    mockAutoCompleteJobs.mockClear();
    mockIsMobile = false;
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: (columns: string) => ({
            eq: () => ({
              single: () => {
                if (columns.includes("selected_job_statuses")) {
                  return Promise.resolve({
                    data: { selected_job_statuses: ["Confirmado", "Tentativa"] },
                    error: null,
                  });
                }
                return Promise.resolve({
                  data: { role: "management" },
                  error: null,
                });
              },
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === "jobs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: {
                  title: "Focused setup job",
                  start_time: "2026-11-12T08:00:00.000Z",
                  job_departments: [{ department: "lights" }],
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    mockUseOptimizedJobs.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseSetupJob.mockImplementation((id?: string) => ({
      data: id ? focusedSetupJob : undefined,
      isLoading: false,
      isError: false,
    }));
  });

  it("activates the user's department tab on first render", async () => {
    mockUseOptimizedAuth.mockReturnValue({
      userDepartment: "lights",
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <ProjectManagement />
      </MemoryRouter>
    );

    const lightsTab = await screen.findByRole("tab", { name: /luces/i });
    const soundTab = screen.getByRole("tab", { name: /sonido/i });

    await waitFor(() => expect(lightsTab).toHaveAttribute("data-state", "active"));
    expect(soundTab).toHaveAttribute("data-state", "inactive");
  });

  it("switches to the user's department once auth loading finishes", async () => {
    let authState = { userDepartment: null as string | null, isLoading: true };
    mockUseOptimizedAuth.mockImplementation(() => authState);

    const { rerender } = render(
      <MemoryRouter>
        <ProjectManagement />
      </MemoryRouter>
    );

    authState = { userDepartment: "video", isLoading: false };
    rerender(
      <MemoryRouter>
        <ProjectManagement />
      </MemoryRouter>
    );

    const videoTab = await screen.findByRole("tab", { name: /video/i });
    await waitFor(() => expect(videoTab).toHaveAttribute("data-state", "active"));
  });

  it("renders mobile filters inline inside the sheet", async () => {
    mockIsMobile = true;
    mockUseOptimizedAuth.mockReturnValue({
      userDepartment: "sound",
      isLoading: false,
    });
    mockUseOptimizedJobs.mockReturnValue({
      data: [
        {
          id: "job-1",
          title: "Mobile Filter Job",
          job_type: "single",
          status: "Confirmado",
          start_time: "2026-06-03T08:00:00.000Z",
          end_time: "2026-06-03T23:00:00.000Z",
        },
        {
          id: "job-2",
          title: "Mobile Tentative Job",
          job_type: "dryhire",
          status: "Tentativa",
          start_time: "2026-06-04T08:00:00.000Z",
          end_time: "2026-06-04T23:00:00.000Z",
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <ProjectManagement />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));

    expect(screen.queryByTestId("job-type-filter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-filter")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /sencillo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmado/i })).toBeInTheDocument();
  });

  it("clears all selected mobile statuses in one state update", async () => {
    mockIsMobile = true;
    mockUseOptimizedAuth.mockReturnValue({
      userDepartment: "sound",
      isLoading: false,
    });
    mockUseOptimizedJobs.mockReturnValue({
      data: [
        {
          id: "job-1",
          title: "Confirmed Job",
          job_type: "single",
          status: "Confirmado",
          start_time: "2026-06-03T08:00:00.000Z",
          end_time: "2026-06-03T23:00:00.000Z",
        },
        {
          id: "job-2",
          title: "Tentative Job",
          job_type: "single",
          status: "Tentativa",
          start_time: "2026-06-04T08:00:00.000Z",
          end_time: "2026-06-04T23:00:00.000Z",
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <ProjectManagement />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));
    await userEvent.click(await screen.findByRole("button", { name: /limpiar todo/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirmado/i })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /tentativa/i })).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("focuses the exact job returned from a setup workflow tool", async () => {
    mockUseOptimizedAuth.mockReturnValue({ userDepartment: "sound", isLoading: false });
    mockUseOptimizedJobs.mockReturnValue({
      data: [
        {
          id: "job-1", title: "Focused setup job", job_type: "single", status: "Completado",
          start_time: "2026-11-12T08:00:00.000Z", end_time: "2026-11-12T20:00:00.000Z",
        },
        {
          id: "job-2", title: "Focused setup job", job_type: "single", status: "Confirmado",
          start_time: "2026-11-12T08:00:00.000Z", end_time: "2026-11-12T20:00:00.000Z",
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/project-management?setupJobId=job-1"]}>
        <ProjectManagement />
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue("Focused setup job")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("tab", { name: /luces/i })).toHaveAttribute("data-state", "active"));
    expect(screen.getByTestId("job-card-job-1")).toBeInTheDocument();
    expect(screen.queryByTestId("job-card-job-2")).not.toBeInTheDocument();
  });
});
