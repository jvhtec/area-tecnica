// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const { invalidateQueriesMock, scheduleDocumentSyncMock, toastMock } = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
  scheduleDocumentSyncMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/utils/tourDateDocumentSync", () => ({
  scheduleTourDateDefaultDocumentSync: scheduleDocumentSyncMock,
}));

import { useTourOverrideMode } from "@/hooks/useTourOverrideMode";

describe("useTourOverrideMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("loads resolved defaults, joined location data, and existing overrides", async () => {
    const defaultSet = {
      id: "set-1",
      tour_id: "tour-1",
      department: "sound",
      name: "Sound M",
      package_size: "m",
    };
    const defaultTable = {
      id: "table-1",
      set_id: "set-1",
      table_name: "Main power",
      table_type: "power",
      total_value: 1200,
      table_data: {
        rows: [{ quantity: "1", componentId: "amp-1", watts: "1200", weight: "0" }],
      },
      metadata: null as null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const powerOverride = {
      id: "power-1",
      tour_date_id: "tour-date-1",
      department: "sound",
      table_name: "Override power",
      pdu_type: "CEE",
      total_watts: 900,
      current_per_phase: 4.1,
    };
    const weightOverride = {
      id: "weight-1",
      tour_date_id: "tour-date-1",
      department: "sound",
      item_name: "Cases",
      weight_kg: 42,
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tours") {
        return createMockQueryBuilder({ data: { name: "Summer Tour" }, error: null });
      }
      if (table === "tour_dates") {
        return createMockQueryBuilder({
          data: {
            date: "2026-07-05",
            tour_id: "tour-1",
            is_tour_pack_only: false,
            sound_package_size: "m",
            sound_default_set_id: null,
            lights_package_size: null,
            lights_default_set_id: null,
            video_package_size: null,
            video_default_set_id: null,
            locations: [{ name: "Madrid" }],
          },
          error: null,
        });
      }
      if (table === "tour_default_sets") {
        return createMockQueryBuilder({ data: [defaultSet], error: null });
      }
      if (table === "tour_default_tables") {
        return createMockQueryBuilder({ data: [defaultTable], error: null });
      }
      if (table === "tour_date_power_overrides") {
        return createMockQueryBuilder({ data: [powerOverride], error: null });
      }
      if (table === "tour_date_weight_overrides") {
        return createMockQueryBuilder({ data: [weightOverride], error: null });
      }
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useTourOverrideMode("tour-1", "tour-date-1", "sound"));

    await waitFor(() => {
      expect(result.current.overrideData?.locationName).toBe("Madrid");
    });

    expect(result.current.overrideData).toMatchObject({
      tourId: "tour-1",
      tourDateId: "tour-date-1",
      tourName: "Summer Tour",
      tourDate: "2026-07-05",
    });
    expect(result.current.overrideData?.defaults).toHaveLength(1);
    expect(result.current.overrideData?.defaults[0].table_data.rows?.[0].watts).toBe("1200");
    expect(result.current.overrideData?.overrides).toEqual([powerOverride, weightOverride]);
    expect(result.current.overrideData?.defaultSetResolution?.status).toBe("resolved");
  });

  it("saves weight overrides with tour date and department context", async () => {
    const insertBuilder = createMockQueryBuilder({ data: null, error: null });
    const weightBuilders = [
      createMockQueryBuilder({ data: [], error: null }),
      insertBuilder,
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tours") {
        return createMockQueryBuilder({ data: { name: "Summer Tour" }, error: null });
      }
      if (table === "tour_dates") {
        return createMockQueryBuilder({
          data: {
            date: "2026-07-05",
            tour_id: "tour-1",
            is_tour_pack_only: false,
            video_package_size: null,
            video_default_set_id: null,
            locations: { name: "Madrid" },
          },
          error: null,
        });
      }
      if (table === "tour_default_sets") {
        return createMockQueryBuilder({ data: [], error: null });
      }
      if (table === "tour_date_power_overrides") {
        return createMockQueryBuilder({ data: [], error: null });
      }
      if (table === "tour_date_weight_overrides") {
        return weightBuilders.shift() ?? createMockQueryBuilder({ data: [], error: null });
      }
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useTourOverrideMode("tour-1", "tour-date-1", "video"));

    await waitFor(() => {
      expect(result.current.overrideData?.locationName).toBe("Madrid");
    });

    await result.current.saveOverride("weight", {
      item_name: "Cases",
      weight_kg: 42,
      override_data: { rows: [{ quantity: "1", componentId: "case-1", weight: "42" }] },
    });

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      tour_date_id: "tour-date-1",
      department: "video",
      item_name: "Cases",
      weight_kg: 42,
      override_data: { rows: [{ quantity: "1", componentId: "case-1", weight: "42" }] },
    });
    expect(scheduleDocumentSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ tourDateId: "tour-date-1" })
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Override saved successfully",
    });
  });

  it("saves power overrides with hook context taking precedence over payload keys", async () => {
    const insertBuilder = createMockQueryBuilder({ data: null, error: null });
    const powerBuilders = [
      createMockQueryBuilder({ data: [], error: null }),
      insertBuilder,
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tours") {
        return createMockQueryBuilder({ data: { name: "Summer Tour" }, error: null });
      }
      if (table === "tour_dates") {
        return createMockQueryBuilder({
          data: {
            date: "2026-07-05",
            tour_id: "tour-1",
            is_tour_pack_only: false,
            sound_package_size: null,
            sound_default_set_id: null,
            locations: { name: "Madrid" },
          },
          error: null,
        });
      }
      if (table === "tour_default_sets") {
        return createMockQueryBuilder({ data: [], error: null });
      }
      if (table === "tour_date_power_overrides") {
        return powerBuilders.shift() ?? createMockQueryBuilder({ data: [], error: null });
      }
      if (table === "tour_date_weight_overrides") {
        return createMockQueryBuilder({ data: [], error: null });
      }
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useTourOverrideMode("tour-1", "tour-date-1", "sound"));

    await waitFor(() => {
      expect(result.current.overrideData?.locationName).toBe("Madrid");
    });

    const payloadWithConflictingContext = {
      table_name: "Main power",
      total_watts: 1200,
      current_per_phase: 5.2,
      pdu_type: "CEE",
      tour_date_id: "wrong-date",
      department: "lights",
    };

    await result.current.saveOverride("power", payloadWithConflictingContext);

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      table_name: "Main power",
      total_watts: 1200,
      current_per_phase: 5.2,
      pdu_type: "CEE",
      tour_date_id: "tour-date-1",
      department: "sound",
    });
    expect(scheduleDocumentSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ tourDateId: "tour-date-1" })
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Override saved successfully",
    });
  });
});
