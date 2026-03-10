// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { createAssignment, createTour, createTourDate } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  useOptimizedAuthMock,
  useTourAssignmentsMock,
  useTourRatesApprovalMock,
  useFlexUuidMock,
  useQueryMock,
  toastMock,
  navigateMock,
  exportTourPDFMock,
  openFlexElementMock,
  fetchTourLogoMock,
} = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  useTourAssignmentsMock: vi.fn(),
  useTourRatesApprovalMock: vi.fn(),
  useFlexUuidMock: vi.fn(),
  useQueryMock: vi.fn(),
  toastMock: vi.fn(),
  navigateMock: vi.fn(),
  exportTourPDFMock: vi.fn(),
  openFlexElementMock: vi.fn(),
  fetchTourLogoMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/hooks/useTourAssignments", () => ({
  useTourAssignments: (...args: any[]) => useTourAssignmentsMock(...args),
}));

vi.mock("@/hooks/useTourRatesApproval", () => ({
  useTourRatesApproval: (...args: any[]) => useTourRatesApprovalMock(...args),
}));

vi.mock("@/hooks/useFlexUuid", () => ({
  useFlexUuid: (...args: any[]) => useFlexUuidMock(...args),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");

  return {
    ...actual,
    useQuery: (...args: any[]) => useQueryMock(...args),
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/utils/pdf/tourLogoUtils", () => ({
  fetchTourLogo: (...args: any[]) => fetchTourLogoMock(...args),
}));

vi.mock("@/lib/tourPdfExport", () => ({
  exportTourPDF: (...args: any[]) => exportTourPDFMock(...args),
}));

vi.mock("@/utils/flex-folders", () => ({
  openFlexElement: (...args: any[]) => openFlexElementMock(...args),
}));

vi.mock("@/assets/icons/icon.png", () => ({
  default: "icon.png",
}));

vi.mock("@/components/tours/TourRatesManagerDialog", () => ({
  TourRatesManagerDialog: ({ open }: { open: boolean }) => (open ? <div>Rates Dialog</div> : null),
}));

vi.mock("@/components/tours/TourManagementDialog", () => ({
  TourManagementDialog: ({ open }: { open: boolean }) => (open ? <div>Tour Settings Dialog</div> : null),
}));

vi.mock("@/components/tours/TourLogisticsDialog", () => ({
  TourLogisticsDialog: ({ open }: { open: boolean }) => (open ? <div>Logistics Dialog</div> : null),
}));

vi.mock("@/components/tours/TourDateManagementDialog", () => ({
  TourDateManagementDialog: ({ open }: { open: boolean }) => (open ? <div>Dates Dialog</div> : null),
}));

vi.mock("@/components/tours/TourDefaultsManager", () => ({
  TourDefaultsManager: ({ open }: { open: boolean }) => (open ? <div>Defaults Dialog</div> : null),
}));

vi.mock("@/components/tours/TourAssignmentDialog", () => ({
  TourAssignmentDialog: ({ open }: { open: boolean }) => (open ? <div>Assignments Dialog</div> : null),
}));

vi.mock("@/components/tours/TourDocumentsDialog", () => ({
  TourDocumentsDialog: ({ open }: { open: boolean }) => (open ? <div>Documents Dialog</div> : null),
}));

vi.mock("@/components/tours/TourPresetManagerDialog", () => ({
  TourPresetManagerDialog: ({ open }: { open: boolean }) => (open ? <div>Presets Dialog</div> : null),
}));

vi.mock("@/components/tasks/TaskManagerDialog", () => ({
  TaskManagerDialog: ({ open }: { open: boolean }) => (open ? <div>Tasks Dialog</div> : null),
}));

vi.mock("@/components/tours/TourSchedulingDialog", () => ({
  TourSchedulingDialog: ({ open }: { open: boolean }) => (open ? <div>Scheduling Dialog</div> : null),
}));

vi.mock("@/components/tours/TourDateFlexButton", () => ({
  TourDateFlexButton: ({ tourDateId }: { tourDateId: string }) => <div>Tour date flex {tourDateId}</div>,
}));

import TourManagement from "../TourManagement";

describe("TourManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
    fetchTourLogoMock.mockResolvedValue(undefined);
    useOptimizedAuthMock.mockReturnValue({ userRole: "management" });
    useTourAssignmentsMock.mockReturnValue({
      assignments: [
        createAssignment({ id: "assignment-1", department: "sound" }),
        createAssignment({ id: "assignment-2", department: "lights" }),
      ],
    });
    useTourRatesApprovalMock.mockReturnValue({
      data: { rates_approved: false },
      refetch: vi.fn(),
    });
    useFlexUuidMock.mockReturnValue({
      flexUuid: null,
      isLoading: false,
      error: null,
      folderExists: false,
    });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "manager-1" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultTour = createTour({
    id: "tour-1",
    name: "World Tour",
    description: "Arena run",
    color: "#2563eb",
    start_date: "2026-03-05",
    end_date: "2026-03-20",
    tour_dates: [
      createTourDate({
        id: "tour-date-past",
        date: "2026-03-08T20:00:00Z",
        location: { id: "loc-1", name: "Barcelona" },
      }),
      createTourDate({
        id: "tour-date-future",
        date: "2026-03-12T20:00:00Z",
        location: { id: "loc-2", name: "Madrid" },
      }),
    ],
  });

  const configureQueryMock = ({
    resolvedJobId = "job-1",
    waGroup = null,
    waRequest = null,
  }: {
    resolvedJobId?: string | null;
    waGroup?: unknown;
    waRequest?: unknown;
  } = {}) => {
    const refetchWaGroup = vi.fn().mockResolvedValue({ data: waGroup });
    const refetchWaRequest = vi.fn().mockResolvedValue({ data: waRequest });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      switch (queryKey[0]) {
        case "tour-date-job-id":
          return { data: resolvedJobId, refetch: vi.fn() };
        case "job-whatsapp-group":
          return { data: waGroup, refetch: refetchWaGroup };
        case "job-whatsapp-group-request":
          return { data: waRequest, refetch: refetchWaRequest };
        default:
          return { data: null, refetch: vi.fn() };
      }
    });

    return { refetchWaGroup, refetchWaRequest };
  };

  const configureSupabase = ({
    jobQueryResults = [{ data: { id: "job-1", title: "Tour Job", start_time: "2026-03-12T08:00:00Z", end_time: "2026-03-12T20:00:00Z" }, error: null }],
    crewRows = [],
    rpcResult = { data: { success: true }, error: null },
  }: {
    jobQueryResults?: Array<{ data: any; error: unknown }>;
    crewRows?: any[];
    rpcResult?: { data: any; error: unknown };
  } = {}) => {
    let jobCall = 0;
    const toursUpdateBuilder = createMockQueryBuilder({ data: null, error: null });
    const updateTourMock = vi.fn(() => toursUpdateBuilder);
    const assignmentsBuilder = createMockQueryBuilder({ data: crewRows, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "jobs") {
        const result = jobQueryResults[Math.min(jobCall, jobQueryResults.length - 1)] ?? { data: null, error: null };
        jobCall += 1;
        return createMockQueryBuilder(result as any);
      }

      if (table === "job_assignments") {
        return assignmentsBuilder;
      }

      if (table === "tours") {
        return {
          update: updateTourMock,
        };
      }

      return createMockQueryBuilder();
    });

    mockSupabase.rpc.mockResolvedValue(rpcResult);

    return {
      assignmentsBuilder,
      toursUpdateBuilder,
      updateTourMock,
    };
  };

  const renderPage = (props?: Partial<React.ComponentProps<typeof TourManagement>>, route = "/tour-management/tour-1") =>
    renderWithProviders(
      <TourManagement
        tour={defaultTour}
        tourJobId="tour-job-1"
        {...props}
      />,
      { route },
    );

  it("treats technician mode from the route or role as a read-only technician view", async () => {
    configureQueryMock();

    const firstRender = renderPage({}, "/tour-management/tour-1?mode=technician");
    expect(await screen.findByText(/vista de técnico/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /grupo whatsapp/i })).not.toBeInTheDocument();
    firstRender.unmount();

    useOptimizedAuthMock.mockReturnValue({ userRole: "house_tech" });
    configureQueryMock();
    renderPage();

    expect(await screen.findByText(/vista de técnico/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver asignaciones/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /imprimir calendario/i })).not.toBeInTheDocument();
  });

  it("renders tour counts and opens the management dialogs from quick actions", async () => {
    const user = userEvent.setup();
    configureQueryMock();

    renderPage();

    expect(screen.getByText("World Tour")).toBeInTheDocument();
    expect(screen.getByText("Fechas Totales")).toBeInTheDocument();
    expect(screen.getByText("Completadas")).toBeInTheDocument();
    expect(screen.getByText("Próximas")).toBeInTheDocument();
    expect(screen.getByText("Crew Asignado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /configuración de gira/i }));
    expect(await screen.findByText("Tour Settings Dialog")).toBeInTheDocument();

    await user.click(screen.getByText("Asignaciones del Equipo"));
    expect(await screen.findByText("Assignments Dialog")).toBeInTheDocument();

    await user.click(screen.getByText("Gestión de Documentos"));
    expect(await screen.findByText("Documents Dialog")).toBeInTheDocument();

    await user.click(screen.getByText("Programación y Línea de Tiempo"));
    expect(await screen.findByText("Scheduling Dialog")).toBeInTheDocument();

    await user.click(screen.getByText("Tareas de Gira"));
    expect(await screen.findByText("Tasks Dialog")).toBeInTheDocument();
  });

  it("shows Flex loading safely, approves rates, opens Flex, and surfaces PDF export failures", async () => {
    const user = userEvent.setup();
    const approvalRefetch = vi.fn();
    useTourRatesApprovalMock.mockReturnValue({
      data: { rates_approved: false },
      refetch: approvalRefetch,
    });
    useFlexUuidMock.mockReturnValueOnce({
      flexUuid: null,
      isLoading: true,
      error: null,
      folderExists: true,
    });
    configureQueryMock();
    const loadingRender = renderPage();

    expect(screen.getByRole("button", { name: /cargando/i })).toBeDisabled();
    loadingRender.unmount();

    useFlexUuidMock.mockReturnValue({
      flexUuid: "flex-folder-1",
      isLoading: false,
      error: null,
      folderExists: true,
    });
    const { updateTourMock, toursUpdateBuilder } = configureSupabase();
    exportTourPDFMock.mockRejectedValueOnce(new Error("pdf failed"));
    configureQueryMock();
    renderPage();

    await user.click(screen.getByRole("button", { name: /aprobar/i }));
    expect(updateTourMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rates_approved: true,
        rates_approved_by: "manager-1",
      }),
    );
    expect(toursUpdateBuilder.eq).toHaveBeenCalledWith("id", "tour-1");
    expect(approvalRefetch).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /flexflex/i }));
    expect(openFlexElementMock).toHaveBeenCalledWith(
      expect.objectContaining({
        elementId: "flex-folder-1",
      }),
    );

    await user.click(screen.getByRole("button", { name: /imprimir calendario/i }));
    expect(exportTourPDFMock).toHaveBeenCalledWith(expect.objectContaining({ id: "tour-1" }));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error",
        variant: "destructive",
      }),
    );
  });

  it("guards WhatsApp creation when no tour date is selected", async () => {
    const user = userEvent.setup();
    configureQueryMock({ resolvedJobId: null });

    renderPage({
      tour: createTour({ ...defaultTour, tour_dates: [] }),
    });

    await user.click(screen.getByRole("button", { name: /grupo whatsapp/i }));
    await user.click(screen.getByRole("button", { name: /crear grupo/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Selecciona una fecha",
        variant: "destructive",
      }),
    );
  });

  it("blocks WhatsApp creation when the selected date has no linked job", async () => {
    const user = userEvent.setup();
    configureQueryMock({ resolvedJobId: null });
    configureSupabase({
      jobQueryResults: [{ data: null, error: null }],
    });

    renderPage();

    await user.click(screen.getByRole("button", { name: /grupo whatsapp/i }));
    await user.click(screen.getByRole("button", { name: /crear grupo/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "No se encontró trabajo",
        variant: "destructive",
      }),
    );
  });

  it("blocks WhatsApp creation when the crew has no valid phones", async () => {
    const user = userEvent.setup();
    configureQueryMock();
    configureSupabase({
      crewRows: [
        {
          sound_role: "chief",
          lights_role: null,
          video_role: null,
          profiles: { first_name: "Pat", last_name: "Jones", phone: "" },
        },
      ],
    });

    renderPage();

    await user.click(screen.getByRole("button", { name: /grupo whatsapp/i }));
    await user.click(screen.getByRole("button", { name: /crear grupo/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sin teléfonos",
        variant: "destructive",
      }),
    );
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("warns for partial phone coverage and invokes the WhatsApp edge function", async () => {
    const user = userEvent.setup();
    const { refetchWaGroup, refetchWaRequest } = configureQueryMock();
    configureSupabase({
      crewRows: [
        {
          sound_role: "chief",
          lights_role: null,
          video_role: null,
          profiles: { first_name: "Pat", last_name: "Jones", phone: "" },
        },
        {
          sound_role: "tech",
          lights_role: null,
          video_role: null,
          profiles: { first_name: "Alex", last_name: "Stone", phone: "+34123456789" },
        },
      ],
    });

    renderPage();

    await user.click(screen.getByRole("button", { name: /grupo whatsapp/i }));
    await user.click(screen.getByRole("button", { name: /crear grupo/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Faltan algunos teléfonos",
      }),
    );
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("create-whatsapp-group", {
      body: { job_id: "job-1", department: "sound", stage_number: 0 },
    });
    await waitFor(() => {
      expect(refetchWaGroup).toHaveBeenCalled();
      expect(refetchWaRequest).toHaveBeenCalled();
    });
  });

  it("handles failed and successful WhatsApp request retries", async () => {
    const user = userEvent.setup();

    configureQueryMock({
      waRequest: { id: "wa-request-1" },
    });
    configureSupabase({
      jobQueryResults: [{ data: { id: "job-1" }, error: null }],
      rpcResult: { data: { success: false, can_retry: false, error: "Cannot retry" }, error: null },
    });

    const firstRender = renderPage();
    await user.click(screen.getByRole("button", { name: /grupo whatsapp/i }));
    await user.click(screen.getByRole("button", { name: /reintentar crear grupo/i }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith("clear_whatsapp_group_request", {
      p_job_id: "job-1",
      p_department: "sound",
      p_stage_number: 0,
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Aviso",
        variant: "destructive",
      }),
    );
    firstRender.unmount();

    const { refetchWaGroup, refetchWaRequest } = configureQueryMock({
      waRequest: { id: "wa-request-1" },
    });
    configureSupabase({
      jobQueryResults: [
        { data: { id: "job-1" }, error: null },
        { data: { id: "job-1", title: "Tour Job", start_time: "2026-03-12T08:00:00Z", end_time: "2026-03-12T20:00:00Z" }, error: null },
      ],
      crewRows: [
        {
          sound_role: "chief",
          lights_role: null,
          video_role: null,
          profiles: { first_name: "Alex", last_name: "Stone", phone: "+34123456789" },
        },
      ],
      rpcResult: { data: { success: true }, error: null },
    });

    renderPage();
    await user.click(screen.getByRole("button", { name: /grupo whatsapp/i }));
    await user.click(screen.getByRole("button", { name: /reintentar crear grupo/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Solicitud limpiada",
      }),
    );
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("create-whatsapp-group", {
      body: { job_id: "job-1", department: "sound", stage_number: 0 },
    });
    await waitFor(() => {
      expect(refetchWaGroup).toHaveBeenCalled();
      expect(refetchWaRequest).toHaveBeenCalled();
    });
  });
});
