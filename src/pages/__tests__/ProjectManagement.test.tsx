// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
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
  useOptimizedJobs: (...args: any[]) => mockUseOptimizedJobs(...args),
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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
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
  JobCardNew: ({ job }: { job: { title: string } }) => (
    <div data-testid={`job-card-${job?.title ?? "unknown"}`}>{job?.title ?? "Unknown"}</div>
  ),
}));

const mockAutoCompleteJobs = vi.fn().mockResolvedValue({ updatedJobs: [], updatedCount: 0 });
vi.mock("@/utils/jobStatusUtils", () => ({
  autoCompleteJobs: (...args: any[]) => mockAutoCompleteJobs(...args),
}));

const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe("ProjectManagement department tabs", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockForceSubscribe.mockReset();
    mockUseOptimizedAuth.mockReset();
    mockUseOptimizedJobs.mockReset();
    mockAutoCompleteJobs.mockClear();
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
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    mockUseOptimizedJobs.mockReturnValue({ data: [], isLoading: false, error: null });
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
});
