import { describe, expect, it, vi } from "vitest";

import { checkAndRecordWhatsappQuota, type WhatsappQuotaClient } from "./whatsappQuota";

function makeClient(result: {
  data?: Array<{ allowed: boolean; used_today: number }> | { allowed: boolean; used_today: number } | null;
  error?: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const client: WhatsappQuotaClient = { rpc };
  return { client, rpc };
}

describe("checkAndRecordWhatsappQuota", () => {
  it("allows a job message when the RPC grants it", async () => {
    const { client, rpc } = makeClient({ data: [{ allowed: true, used_today: 150 }] });

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "job_message",
      recipientCount: 80,
      jobId: "job-1",
      dailyLimit: 500,
    });

    expect(result).toEqual({ allowed: true, usedToday: 150, dailyLimit: 500 });
    expect(rpc).toHaveBeenCalledWith("attempt_whatsapp_send", {
      _actor_id: "actor-1",
      _kind: "job_message",
      _units: 80,
      _daily_limit: 500,
      _job_id: "job-1",
      _recipient_count: 80,
    });
  });

  it("blocks when the RPC denies the request", async () => {
    const { client } = makeClient({ data: [{ allowed: false, used_today: 450 }] });

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "job_message",
      recipientCount: 80,
      dailyLimit: 500,
    });

    expect(result.allowed).toBe(false);
    expect(result.usedToday).toBe(450);
  });

  it("sends group creations as one unit with the participant count recorded", async () => {
    const { client, rpc } = makeClient({ data: [{ allowed: true, used_today: 2 }] });

    await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "group_creation",
      recipientCount: 25,
      jobId: "job-9",
      dailyLimit: 20,
    });

    expect(rpc).toHaveBeenCalledWith("attempt_whatsapp_send", expect.objectContaining({
      _kind: "group_creation",
      _units: 1,
      _recipient_count: 25,
    }));
  });

  it("accepts a single-row (non-array) RPC payload", async () => {
    const { client } = makeClient({ data: { allowed: false, used_today: 20 } });

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "group_creation",
      dailyLimit: 20,
    });

    expect(result).toEqual({ allowed: false, usedToday: 20, dailyLimit: 20 });
  });

  it("fails open when the RPC returns no usable quota row", async () => {
    const { client } = makeClient({ data: null });

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "job_message",
      dailyLimit: 500,
    });

    expect(result).toEqual({ allowed: true, usedToday: 0, dailyLimit: 500 });
  });

  it("fails open when the RPC errors (e.g. migration not applied yet)", async () => {
    const { client } = makeClient({ error: { message: "function attempt_whatsapp_send does not exist" } });

    const result = await checkAndRecordWhatsappQuota({
      supabase: client,
      actorId: "actor-1",
      kind: "job_message",
      recipientCount: 10,
      dailyLimit: 500,
    });

    expect(result.allowed).toBe(true);
  });
});
