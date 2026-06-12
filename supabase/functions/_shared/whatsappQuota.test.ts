import { describe, expect, it, vi } from "vitest";

import { checkAndRecordWhatsappQuota, type WhatsappQuotaClient } from "./whatsappQuota";

function makeClient(rows: Array<{ recipient_count: number | null }>, options: {
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
} = {}) {
  const insert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });
  const gte = vi.fn().mockResolvedValue({ data: options.selectError ? null : rows, error: options.selectError ?? null });
  const client: WhatsappQuotaClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ gte }),
        }),
      }),
      insert,
    }),
  };
  return { client, insert, gte };
}

describe("checkAndRecordWhatsappQuota", () => {
  it("allows and records a job message under the limit", async () => {
    const { client, insert } = makeClient([{ recipient_count: 100 }, { recipient_count: 50 }]);

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "job_message",
      recipientCount: 80,
      jobId: "job-1",
      dailyLimit: 500,
    });

    expect(result).toEqual({ allowed: true, usedToday: 150, dailyLimit: 500 });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      actor_id: "actor-1",
      kind: "job_message",
      job_id: "job-1",
      recipient_count: 80,
    }));
  });

  it("blocks a job message that would exceed the daily recipient limit", async () => {
    const { client, insert } = makeClient([{ recipient_count: 450 }]);

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "job_message",
      recipientCount: 80,
      dailyLimit: 500,
    });

    expect(result.allowed).toBe(false);
    expect(result.usedToday).toBe(450);
    expect(insert).not.toHaveBeenCalled();
  });

  it("counts group creations as one unit each", async () => {
    const { client, insert } = makeClient([
      { recipient_count: 12 },
      { recipient_count: 30 },
    ]);

    const blocked = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "group_creation",
      recipientCount: 25,
      dailyLimit: 2,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.usedToday).toBe(2);
    expect(insert).not.toHaveBeenCalled();

    const allowed = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "group_creation",
      recipientCount: 25,
      dailyLimit: 3,
    });

    expect(allowed.allowed).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ kind: "group_creation", recipient_count: 25 }));
  });

  it("fails open when the ledger lookup errors", async () => {
    const { client, insert } = makeClient([], { selectError: { message: "relation missing" } });

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "job_message",
      recipientCount: 10,
      dailyLimit: 500,
    });

    expect(result.allowed).toBe(true);
    expect(insert).toHaveBeenCalled();
  });
});
