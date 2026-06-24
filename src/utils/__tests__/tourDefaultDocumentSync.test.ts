import { describe, expect, it } from "vitest";
import {
  buildTourDefaultDocumentPlan,
  getTourDefaultDocumentObjectPath,
  type TourDefaultDocumentPlanItem,
  type TourDefaultDocumentSyncData,
} from "@/utils/tourDefaultDocumentSync";

type SyncTourDate = TourDefaultDocumentSyncData["tourDates"][number];
type SyncDefaultSet = TourDefaultDocumentSyncData["defaultSets"][number];
type SyncDefaultTable = TourDefaultDocumentSyncData["defaultTables"][number];
type UploadPlanItem = Extract<TourDefaultDocumentPlanItem, { action: "upload" }>;

const baseDate: SyncTourDate = {
  created_at: "2026-06-01T00:00:00Z",
  date: "2026-07-10",
  end_date: "2026-07-10",
  flex_folders_created: false,
  id: "date-1",
  is_tour_pack_only: null,
  lights_default_set_id: null,
  lights_package_size: null,
  location_id: "loc-1",
  rehearsal_days: 1,
  sound_default_set_id: null,
  sound_package_size: "s" as const,
  start_date: "2026-07-10",
  tour_date_type: "show" as const,
  tour_id: "tour-1",
  video_default_set_id: null,
  video_package_size: null,
  locations: { name: "Madrid" },
};

const buildSet = (overrides: Partial<SyncDefaultSet>): SyncDefaultSet => ({
  created_at: "2026-06-01T00:00:00Z",
  department: "sound",
  description: null,
  id: "set-s",
  name: "Small",
  package_size: "s" as const,
  tour_id: "tour-1",
  updated_at: "2026-06-01T00:00:00Z",
  ...overrides,
});

const buildTable = (
  overrides: Partial<SyncDefaultTable>
): SyncDefaultTable => ({
  created_at: "2026-06-01T00:00:00Z",
  id: "table-1",
  metadata: { order_index: 0 },
  set_id: "set-s",
  table_data: {
    rows: [{ quantity: "1", componentName: "K1", weight: "106", totalWeight: 106 }],
  },
  table_name: "Main PA",
  table_type: "weight",
  total_value: 106,
  updated_at: "2026-06-01T00:00:00Z",
  ...overrides,
});

const findUploadPlanItem = (
  plan: TourDefaultDocumentPlanItem[],
  department: UploadPlanItem["department"] = "sound",
  type: UploadPlanItem["type"] = "weight"
): UploadPlanItem | undefined => {
  const item = plan.find(
    (candidate) =>
      candidate.action === "upload" &&
      candidate.department === department &&
      candidate.type === type
  );
  return item?.action === "upload" ? item : undefined;
};

const buildData = (
  overrides: Partial<TourDefaultDocumentSyncData> = {}
): TourDefaultDocumentSyncData => ({
  tour: { id: "tour-1", name: "Enterprise Tour" },
  tourDates: [baseDate],
  defaultSets: [buildSet({})],
  defaultTables: [buildTable({})],
  powerOverrides: [],
  weightOverrides: [],
  ...overrides,
});

describe("tour default document sync planning", () => {
  it("uploads the resolved package PDF and cleans unrelated date/dept/type slots", () => {
    const plan = buildTourDefaultDocumentPlan(buildData());

    const soundWeightUpload = findUploadPlanItem(plan);
    expect(soundWeightUpload).toMatchObject({
      action: "upload",
      objectPath: "tours/tour-1/auto-generated/default-pdfs/date-1/sound-weight.pdf",
      fileName: "Enterprise Tour - 2026-07-10 - Madrid - Sound S - Small peso.pdf",
    });

    expect(
      plan.some(
        (item) =>
          item.action === "cleanup" &&
          item.department === "sound" &&
          item.type === "power" &&
          item.reason === "no_tables"
      )
    ).toBe(true);
    expect(plan).toHaveLength(6);
  });

  it("keeps the same object path when a date switches package size", () => {
    const sPlan = buildTourDefaultDocumentPlan(buildData());
    const mPlan = buildTourDefaultDocumentPlan(
      buildData({
        tourDates: [{ ...baseDate, sound_package_size: "m" }],
        defaultSets: [buildSet({ id: "set-m", name: "Medium", package_size: "m" })],
        defaultTables: [buildTable({ id: "table-m", set_id: "set-m" })],
      })
    );

    const sUpload = findUploadPlanItem(sPlan);
    const mUpload = findUploadPlanItem(mPlan);

    expect(sUpload?.objectPath).toBe(mUpload?.objectPath);
    expect(sUpload?.fileName).toContain("Sound S - Small");
    expect(mUpload?.fileName).toContain("Sound M - Medium");
  });

  it("cleans the stable slot instead of leaving stale files when package resolution is ambiguous", () => {
    const plan = buildTourDefaultDocumentPlan(
      buildData({
        defaultSets: [
          buildSet({ id: "set-s-a", name: "Small A" }),
          buildSet({ id: "set-s-b", name: "Small B" }),
        ],
        defaultTables: [
          buildTable({ id: "table-a", set_id: "set-s-a" }),
          buildTable({ id: "table-b", set_id: "set-s-b" }),
        ],
      })
    );

    expect(
      plan.find(
        (item) =>
          item.action === "cleanup" &&
          item.department === "sound" &&
          item.type === "weight"
      )
    ).toMatchObject({
      objectPath: getTourDefaultDocumentObjectPath({
        tourId: "tour-1",
        tourDateId: "date-1",
        department: "sound",
        type: "weight",
      }),
      reason: "ambiguous_default_set",
    });
  });

  it("cleans the stable slot when a resolved set has no tables for that PDF type", () => {
    const plan = buildTourDefaultDocumentPlan(buildData({ defaultTables: [] }));

    expect(
      plan.find(
        (item) =>
          item.action === "cleanup" &&
          item.department === "sound" &&
          item.type === "weight"
      )
    ).toMatchObject({
      reason: "no_tables",
      objectPath: "tours/tour-1/auto-generated/default-pdfs/date-1/sound-weight.pdf",
    });
  });
});
