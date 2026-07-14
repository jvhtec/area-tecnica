import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exportToPDF: vi.fn(),
  fetchTourLogo: vi.fn(),
}));

vi.mock("@/utils/pdfExport", () => ({
  exportToPDF: mocks.exportToPDF,
}));

vi.mock("@/utils/pdf/logoUtils", () => ({
  fetchTourLogo: mocks.fetchTourLogo,
  fetchJobLogo: vi.fn(),
  fetchLogoUrl: vi.fn(),
  getCompanyLogo: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

import {
  resolveTourIdForTourDate,
  scheduleTourDateDefaultDocumentSync,
  syncTourDefaultDocumentsForTourDate,
} from "@/utils/tourDateDocumentSync";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

const CHAIN_METHODS = [
  "select",
  "eq",
  "in",
  "order",
  "like",
  "delete",
  "insert",
  "update",
  "not",
] as const;

const createFakeClient = () => {
  const tableResults = new Map<string, QueryResult[]>();
  const calls: RecordedCall[] = [];

  const enqueue = (table: string, result: QueryResult) => {
    const queue = tableResults.get(table) ?? [];
    queue.push(result);
    tableResults.set(table, queue);
  };

  const nextResult = (table: string): QueryResult => {
    const queue = tableResults.get(table);
    if (!queue || queue.length === 0) return { data: null, error: null };
    // Keep the last result sticky so repeated lookups (e.g. per-slot
    // tour_documents cleanup) reuse it.
    return queue.length > 1 ? queue.shift()! : queue[0];
  };

  const from = vi.fn((table: string) => {
    const stub: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      stub[method] = vi.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        return stub;
      });
    }
    stub.maybeSingle = vi.fn(() => Promise.resolve(nextResult(table)));
    stub.single = vi.fn(() => Promise.resolve(nextResult(table)));
    (stub as { then?: unknown }).then = (
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
    return stub;
  });

  const storageRemove = vi.fn().mockResolvedValue({ error: null });
  const storageUpload = vi.fn().mockResolvedValue({ error: null });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    from,
    storage: {
      from: vi.fn(() => ({ remove: storageRemove, upload: storageUpload })),
    },
  };

  return { calls, client, enqueue, from, storageRemove, storageUpload };
};

const tourDateRow = {
  id: "date-1",
  tour_id: "tour-1",
  date: "2026-07-10",
  start_date: "2026-07-10",
  end_date: "2026-07-10",
  is_tour_pack_only: null as boolean | null,
  sound_package_size: "s",
  lights_package_size: null as string | null,
  video_package_size: null as string | null,
  sound_default_set_id: null as string | null,
  lights_default_set_id: null as string | null,
  video_default_set_id: null as string | null,
  locations: { name: "Madrid" },
};

const soundSet = {
  id: "set-s",
  tour_id: "tour-1",
  name: "Small",
  department: "sound",
  description: null as string | null,
  package_size: "s",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const soundWeightTable = {
  id: "table-1",
  set_id: "set-s",
  table_name: "Main PA",
  table_type: "weight",
  total_value: 106,
  table_data: {
    rows: [{ quantity: "1", componentName: "K1", weight: "106", totalWeight: 106 }],
  },
  metadata: { order_index: 0 },
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

describe("per-tour-date default document sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exportToPDF.mockResolvedValue(new Blob(["pdf"]));
    mocks.fetchTourLogo.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves the owning tour id for a tour date", async () => {
    const { client, enqueue } = createFakeClient();
    enqueue("tour_dates", { data: { tour_id: "tour-1" }, error: null });

    await expect(
      resolveTourIdForTourDate("date-1", client as never)
    ).resolves.toBe("tour-1");
  });

  it("returns null without syncing when the tour date no longer exists", async () => {
    const { client, from } = createFakeClient();

    await expect(
      syncTourDefaultDocumentsForTourDate({ tourDateId: "gone", client: client as never })
    ).resolves.toBeNull();

    expect(from).toHaveBeenCalledTimes(1);
    expect(mocks.exportToPDF).not.toHaveBeenCalled();
  });

  it("regenerates only the affected date's PDFs after an override-style change", async () => {
    const { calls, client, enqueue, storageUpload } = createFakeClient();
    enqueue("tour_dates", { data: { tour_id: "tour-1" }, error: null });
    enqueue("tour_dates", { data: [tourDateRow], error: null });
    enqueue("tours", { data: { id: "tour-1", name: "Enterprise Tour" }, error: null });
    enqueue("tour_default_sets", { data: [soundSet], error: null });
    enqueue("tour_default_tables", { data: [soundWeightTable], error: null });
    enqueue("tour_date_power_overrides", { data: [], error: null });
    enqueue("tour_date_weight_overrides", { data: [], error: null });
    enqueue("tour_documents", { data: [], error: null });

    const outcome = await syncTourDefaultDocumentsForTourDate({
      tourDateId: "date-1",
      client: client as never,
    });

    expect(outcome?.tourId).toBe("tour-1");
    // One slot resolves (sound weight); the other five slots are cleaned.
    expect(outcome?.result).toMatchObject({ uploaded: 1, errors: [] });
    expect(outcome?.result.removed).toBe(5);

    // The date list query is scoped to the affected tour date only.
    expect(
      calls.some(
        (call) =>
          call.table === "tour_dates" &&
          call.method === "in" &&
          call.args[0] === "id" &&
          JSON.stringify(call.args[1]) === JSON.stringify(["date-1"])
      )
    ).toBe(true);

    expect(mocks.exportToPDF).toHaveBeenCalledTimes(1);
    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(storageUpload.mock.calls[0][0]).toMatch(
      /^tours\/tour-1\/auto-generated\/default-pdfs\/date-1\/sound-weight-[a-z0-9]+\.pdf$/
    );

    expect(
      calls.some(
        (call) =>
          call.table === "tour_documents" &&
          call.method === "insert" &&
          (call.args[0] as { file_name?: string })?.file_name ===
            "Enterprise Tour - 2026-07-10 - Madrid - Sound S - Small peso.pdf"
      )
    ).toBe(true);
  });

  it("coalesces rapid schedule calls into a single sync per tour date", async () => {
    vi.useFakeTimers();
    const { client, from } = createFakeClient();
    const onComplete = vi.fn();

    scheduleTourDateDefaultDocumentSync({
      tourDateId: "date-x",
      client: client as never,
      delayMs: 100,
      onComplete,
    });
    scheduleTourDateDefaultDocumentSync({
      tourDateId: "date-x",
      client: client as never,
      delayMs: 100,
      onComplete,
    });

    await vi.advanceTimersByTimeAsync(250);

    // Only one resolve lookup ran: the second schedule replaced the first.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("tour_dates");
    // Tour date missing -> nothing to sync, so no completion callback.
    expect(onComplete).not.toHaveBeenCalled();
  });
});
