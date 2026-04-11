// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  toastMock,
  getOrCreateLocationMock,
  getOrCreateLocationWithDetailsMock,
  syncJobRehearsalDatesMock,
  syncJobRehearsalDatesForJobsMock,
  syncFlexElementsForTourDateChangeMock,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  getOrCreateLocationMock: vi.fn(),
  getOrCreateLocationWithDetailsMock: vi.fn(),
  syncJobRehearsalDatesMock: vi.fn(),
  syncJobRehearsalDatesForJobsMock: vi.fn(),
  syncFlexElementsForTourDateChangeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/useLocationManagement", () => ({
  useLocationManagement: () => ({
    getOrCreateLocation: getOrCreateLocationMock,
    getOrCreateLocationWithDetails: getOrCreateLocationWithDetailsMock,
  }),
}));

vi.mock("@/hooks/useTourDateRealtime", () => ({
  useTourDateRealtime: vi.fn(),
}));

vi.mock("@/services/jobRehearsalDates", async () => {
  const actual = await vi.importActual<typeof import("@/services/jobRehearsalDates")>("@/services/jobRehearsalDates");

  return {
    ...actual,
    syncJobRehearsalDates: syncJobRehearsalDatesMock,
    syncJobRehearsalDatesForJobs: syncJobRehearsalDatesForJobsMock,
  };
});

vi.mock("@/utils/flex-folders/syncDateChange", () => ({
  syncFlexElementsForTourDateChange: syncFlexElementsForTourDateChangeMock,
}));

vi.mock("@/components/maps/PlaceAutocomplete", () => ({
  PlaceAutocomplete: ({
    value,
    label = "Location",
    placeholder,
    onInputChange,
  }: {
    value: string;
    label?: string;
    placeholder?: string;
    onInputChange?: (value: string) => void;
  }) => (
    <div>
      <label htmlFor={`mock-place-${label}`}>{label}</label>
      <input
        id={`mock-place-${label}`}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onInputChange?.(event.target.value)}
      />
    </div>
  ),
}));

import { TourDateManagementDialog } from "../TourDateManagementDialog";

function queueTableBuilders(buildersByTable: Record<string, ReturnType<typeof createMockQueryBuilder>[]>) {
  const queue = new Map(Object.entries(buildersByTable));

  mockSupabase.from.mockImplementation((table: string) => {
    const builders = queue.get(table);
    if (!builders || builders.length === 0) {
      return createMockQueryBuilder();
    }
    return builders.shift() ?? createMockQueryBuilder();
  });
}

describe("TourDateManagementDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    getOrCreateLocationMock.mockResolvedValue("location-1");
    getOrCreateLocationWithDetailsMock.mockResolvedValue("location-1");
    syncJobRehearsalDatesMock.mockResolvedValue(undefined);
    syncJobRehearsalDatesForJobsMock.mockResolvedValue(undefined);
    syncFlexElementsForTourDateChangeMock.mockResolvedValue({ success: 0, failed: 0, errors: [] });
  });

  it("seeds rehearsal toggle rows for every scheduled day when creating a rehearsal date", async () => {
    const user = userEvent.setup();
    const tourDateBuilder = createMockQueryBuilder({
      data: {
        id: "tour-date-1",
        date: "2026-04-10",
        start_date: "2026-04-10",
        end_date: "2026-04-12",
        tour_date_type: "rehearsal",
        rehearsal_days: 3,
        is_tour_pack_only: false,
        location: { id: "location-1", name: "Madrid Arena" },
      },
      error: null,
    });
    const tourBuilder = createMockQueryBuilder({
      data: {
        name: "World Tour",
        color: "#123456",
        tour_dates: [{ jobs: [{ job_departments: [{ department: "sound" }] }] }],
      },
      error: null,
    });
    const jobsBuilder = createMockQueryBuilder({
      data: { id: "job-1" },
      error: null,
    });
    const jobDepartmentsBuilder = createMockQueryBuilder({ data: null, error: null });
    const jobDateTypesBuilder = createMockQueryBuilder({ data: null, error: null });

    queueTableBuilders({
      tour_dates: [tourDateBuilder],
      tours: [tourBuilder],
      jobs: [jobsBuilder],
      job_departments: [jobDepartmentsBuilder],
      job_date_types: [jobDateTypesBuilder],
    });

    renderWithProviders(
      <TourDateManagementDialog
        open
        onOpenChange={vi.fn()}
        tourId="tour-1"
        tourDates={[]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /rehearsal/i }));
    await user.type(screen.getByLabelText(/^location$/i), "Madrid Arena");
    await user.type(screen.getByLabelText(/start date/i), "2026-04-10");
    await user.type(screen.getByLabelText(/end date/i), "2026-04-12");

    await user.click(screen.getByRole("button", { name: /añadir/i }));

    await waitFor(() => {
      expect(syncJobRehearsalDatesMock).toHaveBeenCalledWith(
        "job-1",
        ["2026-04-10", "2026-04-11", "2026-04-12"],
        { seedMissing: true },
      );
    });

    expect(jobDateTypesBuilder.insert).toHaveBeenCalledWith([
      { job_id: "job-1", date: "2026-04-10", type: "rehearsal" },
      { job_id: "job-1", date: "2026-04-11", type: "rehearsal" },
      { job_id: "job-1", date: "2026-04-12", type: "rehearsal" },
    ]);
  });

  it("keeps rehearsal toggles as the pricing source of truth when editing a rehearsal date back to show", async () => {
    const user = userEvent.setup();
    const flexFoldersBuilder = createMockQueryBuilder({
      data: [],
      error: null,
    });
    const toursBuilder = createMockQueryBuilder({
      data: { name: "World Tour" },
      error: null,
    });
    const updatedTourDateBuilder = createMockQueryBuilder({
      data: {
        id: "tour-date-1",
        date: "2026-04-01",
        is_tour_pack_only: false,
        location: { id: "location-1", name: "Madrid Arena" },
        tours: { name: "World Tour" },
      },
      error: null,
    });
    const jobsBuilder = createMockQueryBuilder({
      data: [{ id: "job-1" }],
      error: null,
    });
    const deleteJobDateTypesBuilder = createMockQueryBuilder({ data: null, error: null });
    const insertJobDateTypesBuilder = createMockQueryBuilder({ data: null, error: null });

    queueTableBuilders({
      flex_folders: [flexFoldersBuilder],
      tours: [toursBuilder],
      tour_dates: [updatedTourDateBuilder],
      jobs: [jobsBuilder],
      job_date_types: [deleteJobDateTypesBuilder, insertJobDateTypesBuilder],
    });

    renderWithProviders(
      <TourDateManagementDialog
        open
        onOpenChange={vi.fn()}
        tourId="tour-1"
        tourDates={[
          {
            id: "tour-date-1",
            date: "2026-04-01",
            start_date: "2026-04-01",
            end_date: "2026-04-03",
            tour_id: "tour-1",
            location_id: "location-1",
            location: { id: "location-1", name: "Madrid Arena" },
            tour_date_type: "rehearsal",
            is_tour_pack_only: false,
          },
        ]}
      />,
    );

    await user.click(screen.getByTitle("Edit Date"));

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: /^show$/i }));

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(syncJobRehearsalDatesForJobsMock).toHaveBeenCalledWith(
        ["job-1"],
        ["2026-04-01"],
        { seedMissing: false },
      );
    });

    expect(insertJobDateTypesBuilder.insert).toHaveBeenCalledWith([
      { job_id: "job-1", date: "2026-04-01", type: "show" },
    ]);
  });
});
