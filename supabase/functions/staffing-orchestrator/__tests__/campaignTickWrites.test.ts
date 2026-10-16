import { describe, expect, it, vi } from "vitest";

vi.mock("../../_shared/structuredLogger.ts", () => ({ logEvent: vi.fn() }));

import { closeCampaignIfJobOver } from "../campaignTickWrites.ts";

type Filter = [string, string, unknown];

/** A query-builder stand-in that records the closing update's filters. */
function fakeClient({ job, closedRows }: { job: unknown; closedRows: Array<{ id: string }> }) {
  const updates: Filter[][] = [];
  const inserts: unknown[] = [];
  const from = (table: string) => {
    const filters: Filter[] = [];
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = (column: string, value: unknown) => (filters.push(["eq", column, value]), builder);
    builder.is = (column: string, value: unknown) => (filters.push(["is", column, value]), builder);
    builder.maybeSingle = () => Promise.resolve({ data: job, error: null });
    builder.update = () => {
      updates.push(filters);
      builder.select = () => Promise.resolve({ data: closedRows, error: null });
      return builder;
    };
    builder.insert = (row: unknown) => (inserts.push({ table, row }), Promise.resolve({ error: null }));
    return builder;
  };
  return { client: { from } as never, updates, inserts };
}

const now = new Date("2026-10-16T12:00:00Z");
const endedJob = { end_time: "2026-10-01T00:00:00Z", status: "confirmado" };

describe("closeCampaignIfJobOver", () => {
  it("leaves a campaign whose job is still on alone", async () => {
    const { client, updates } = fakeClient({ job: { end_time: "2026-11-01T00:00:00Z", status: "confirmado" }, closedRows: [] });
    await expect(closeCampaignIfJobOver(client, { id: "c1", job_id: "j1", run_lock: null }, now)).resolves.toBeNull();
    expect(updates).toHaveLength(0);
  });

  it("closes an unlocked campaign only while it is still unlocked", async () => {
    const { client, updates, inserts } = fakeClient({ job: endedJob, closedRows: [{ id: "c1" }] });
    await expect(closeCampaignIfJobOver(client, { id: "c1", job_id: "j1", run_lock: null }, now)).resolves.toEqual({
      closed: "job_ended",
    });
    expect(updates[0]).toContainEqual(["is", "run_lock", null]);
    expect(inserts).toHaveLength(1);
  });

  it("clears a stale lock only if it is still the one it read", async () => {
    const { client, updates } = fakeClient({ job: endedJob, closedRows: [{ id: "c1" }] });
    await closeCampaignIfJobOver(client, { id: "c1", job_id: "j1", run_lock: "stale-lock" }, now);
    expect(updates[0]).toContainEqual(["eq", "run_lock", "stale-lock"]);
  });

  it("backs off when another tick took the lock meanwhile", async () => {
    const { client, inserts } = fakeClient({ job: endedJob, closedRows: [] });
    await expect(closeCampaignIfJobOver(client, { id: "c1", job_id: "j1", run_lock: null }, now)).resolves.toBeNull();
    expect(inserts).toHaveLength(0);
  });
});
