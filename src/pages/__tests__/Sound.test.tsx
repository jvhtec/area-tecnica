// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { addDays, endOfMonth, startOfMonth, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import Sound from "../Sound";

const { mockUseOptimizedJobs } = vi.hoisted(() => ({
  mockUseOptimizedJobs: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedJobs", () => ({
  useOptimizedJobs: (...args: unknown[]) => mockUseOptimizedJobs(...args),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: () => ({
    user: { id: "user-1" },
    userRole: "management",
    userDepartment: "sound",
    hasSoundVisionAccess: true,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useTechnicianTheme", () => ({
  useTechnicianTheme: () => ({ theme: {}, isDark: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/ui/confirm-dialog", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/confirm-dialog")>(
    "@/components/ui/confirm-dialog",
  );
  return {
    ...actual,
    useConfirm: () => vi.fn(),
  };
});

vi.mock("@/components/dashboard/CalendarSection", () => ({
  CalendarSection: ({ jobs = [] }: { jobs?: Array<{ id: string; title: string }> }) => (
    <div data-testid="sound-calendar">
      {jobs.map((job) => <span key={job.id}>{job.title}</span>)}
    </div>
  ),
}));

vi.mock("@/components/jobs/CreateJobDialog", () => ({ CreateJobDialog: (): null => null }));
vi.mock("@/components/jobs/JobAssignmentDialog", () => ({ JobAssignmentDialog: (): null => null }));
vi.mock("@/components/jobs/EditJobDialog", () => ({ EditJobDialog: (): null => null }));
vi.mock("@/components/lights/LightsHeader", () => ({ LightsHeader: (): null => null }));
vi.mock("@/components/dashboard/TodaySchedule", () => ({ TodaySchedule: (): null => null }));
vi.mock("@/components/sound/ReportGenerator", () => ({ ReportGenerator: (): null => null }));
vi.mock("@/components/sound/AmplifierTool", () => ({ AmplifierTool: (): null => null }));
vi.mock("@/components/sound/amplifier-tool/rack-designer/AmpRackDesigner", () => ({
  AmpRackDesigner: (): null => null,
}));
vi.mock("@/components/sound/MemoriaTecnica", () => ({ MemoriaTecnica: (): null => null }));
vi.mock("@/components/sound/tools", () => ({ IncidentReport: (): null => null }));
vi.mock("@/components/soundvision/SoundVisionAccessRequestDialog", () => ({
  SoundVisionAccessRequestDialog: (): null => null,
}));
vi.mock("@/components/department/DepartmentMobileHub", () => ({ DepartmentMobileHub: (): null => null }));
vi.mock("@/components/layout/MobileNavBar", () => ({ MobileNavBar: (): null => null }));
vi.mock("@/components/jobs/JobDetailsDialog", () => ({ JobDetailsDialog: (): null => null }));
vi.mock("@/components/department/EnhancedJobDetailsModal", () => ({ EnhancedJobDetailsModal: (): null => null }));
vi.mock("@/components/department/MobileAssignmentsDialog", () => ({ MobileAssignmentsDialog: (): null => null }));
vi.mock("@/components/layout/SidebarNavigation", () => ({ buildNavigationItems: (): [] => [] }));
vi.mock("@/components/layout/Layout", () => ({ selectPrimaryNavigationItems: (): [] => [] }));
vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: { auth: { signOut: vi.fn() } },
}));
vi.mock("@/services/optimisticJobDeletionService", () => ({
  deleteJobOptimistically: vi.fn(),
}));

describe("Sound calendar data range", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    mockUseOptimizedJobs.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests the visible month for sound and renders jobs beyond the legacy 1,000-row cutoff", () => {
    const lateSeptemberJob = {
      id: "job-1001",
      title: "KBS Music Bank",
      job_type: "single",
      status: "Tentativa",
      start_time: "2026-09-09T06:00:00.000Z",
      end_time: "2026-09-13T21:00:00.000Z",
      job_departments: [{ department: "sound" }],
    };
    mockUseOptimizedJobs.mockReturnValue({
      data: [lateSeptemberJob],
      isLoading: false,
    });

    renderWithProviders(<Sound />, { route: "/sound" });

    const monthAnchor = new Date("2026-09-15T12:00:00.000Z");
    expect(mockUseOptimizedJobs).toHaveBeenCalledWith(
      "sound",
      subDays(startOfMonth(monthAnchor), 7),
      addDays(endOfMonth(monthAnchor), 14),
    );
    expect(screen.getByTestId("sound-calendar")).toHaveTextContent("KBS Music Bank");
  });
});
