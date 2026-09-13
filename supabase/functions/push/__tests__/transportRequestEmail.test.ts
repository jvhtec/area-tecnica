import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../deps.ts";
import { sendBrevoEmail } from "../../_shared/brevo.ts";
import { sendTransportRequestEmail } from "../transportRequestEmail.ts";
import { formatTransportRequestEmail } from "../transportRequestEmailFormat.ts";

vi.mock("../../_shared/brevo.ts", () => ({ sendBrevoEmail: vi.fn() }));

const requestId = "10000000-0000-4000-8000-000000000001";
const creatorId = "20000000-0000-4000-8000-000000000001";
const serviceId = "00000000-0000-0000-0000-000000000000";
const now = new Date("2026-09-13T12:00:00Z");
const request = {
  id: requestId, job_id: "job-1", created_by: creatorId, created_at: now.toISOString(),
  status: "requested", planning_status: "requested", department: "sound",
  description: "Material <script>alert(1)</script>", note: "Acceso & horario\nPuerta <B>",
  needed_at: "2026-09-14T08:30:00Z", origin: "Almacén", destination: "Recinto",
  movement_type: "pickup", priority: "urgent", source_type: "manual", transport_type: null,
};
const job = { id: "job-1", title: "Festival <Sol>", start_time: "2026-09-14T20:00:00Z", end_time: null, timezone: "Europe/Madrid" };
const requester = { id: creatorId, first_name: "Ana <", last_name: "García", email: "ana@example.com", department: "sound", role: "management" };
const items = [
  { id: "item-1", request_id: requestId, transport_type: "trailer", leftover_space_meters: 0 },
  { id: "item-2", request_id: requestId, transport_type: "furgoneta", leftover_space_meters: 2.5 },
];
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function mockClient(overrides: Partial<Tables> = {}, errorTable?: string) {
  const tables: Tables = {
    transport_requests: [{ ...request }], jobs: [{ ...job }], transport_request_items: items,
    profiles: [{ ...requester }, { id: "log-1", email: "log@example.com", department: "logistics", role: "technician" }],
    ...overrides,
  };
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] || [])];
    const result = () => ({ data: errorTable === table ? null : rows, error: errorTable === table ? { message: "private error details" } : null });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; }),
      order: vi.fn(() => query),
      range: vi.fn((start: number, end: number) => { rows = rows.slice(start, end + 1); return query; }),
      maybeSingle: vi.fn(async () => { const res = result(); return { ...res, data: res.data?.[0] ?? null }; }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from };
}

function payload(index = 0) {
  return vi.mocked(sendBrevoEmail).mock.calls[index][1] as {
    to: Array<{ email: string }>; sender: { email: string; name: string };
    subject: string; htmlContent: string; headers: { idempotencyKey: string };
  };
}

describe("sendTransportRequestEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    vi.stubGlobal("Deno", { env: { get: (name: string) => ({ BREVO_API_KEY: "test-key", BREVO_FROM: "corporate@example.com" }[name]) } });
    vi.mocked(sendBrevoEmail).mockImplementation(async () => new Response(null, { status: 201 }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("loads authoritative request, requester and job data and escapes the corporate content", async () => {
    const { client, from } = mockClient();
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toEqual({ status: "sent", sent: 1, failed: 0, skipped: 0 });
    const email = payload();
    expect(email.sender).toEqual({ email: "corporate@example.com", name: "Área Técnica | Sector Pro" });
    expect(email.htmlContent).toContain("Ana &lt; García");
    expect(email.htmlContent).toContain("ana@example.com");
    expect(email.htmlContent).toContain("Festival &lt;Sol&gt;");
    expect(email.htmlContent).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.htmlContent).not.toContain("<script>");
    for (const detail of ["Sonido", "14 sept 2026, 10:30", "Recogida", "Urgente", "Manual", "Almacén", "Recinto", "Tráiler", "Furgoneta", "0 m", "2.5 m"]) expect(email.htmlContent).toContain(detail);
    expect(email.htmlContent).toContain('href="https://sector-pro.work/logistics"');
    expect(email.htmlContent).not.toContain("jobId=");
    expect(from.mock.calls.map(([table]) => table)).not.toContain("push_subscriptions");
    expect(from.mock.calls.map(([table]) => table)).not.toContain("notification_preferences");
  });

  it.each([undefined, "", "bogus", { id: requestId }])("rejects malformed ID %s before querying", async (id) => {
    const { client, from } = mockClient();
    expect(await sendTransportRequestEmail(client, creatorId, id as string)).toMatchObject({ reason: "invalid_request_id" });
    expect(from).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it.each(["technician", "logistics", "house_tech", null])("denies a creator with role %s", async (role) => {
    const { client } = mockClient({ profiles: [{ ...requester, role }] });
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toMatchObject({ reason: "forbidden" });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it.each(["admin", "management"])("requires ownership even for %s", async (role) => {
    const { client } = mockClient({ profiles: [{ ...requester, id: "other", role }] });
    expect(await sendTransportRequestEmail(client, "other", requestId)).toMatchObject({ reason: "forbidden" });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("permits an admin owner and trusted service, retaining the real requester identity", async () => {
    const { client } = mockClient({ profiles: [{ ...requester, role: "admin" }, { email: "log@example.com", department: "logistics" }] });
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toMatchObject({ sent: 1 });
    expect(await sendTransportRequestEmail(client, serviceId, requestId)).toMatchObject({ sent: 1 });
    expect(payload(1).htmlContent).toContain("ana@example.com");
    expect(payload(1).htmlContent).not.toContain(serviceId);
  });

  it.each([
    [{ status: "fulfilled" }, "request_closed"], [{ status: "cancelled" }, "request_closed"],
    [{ planning_status: "completed" }, "request_closed"], [{ planning_status: "cancelled" }, "request_closed"],
    [{ created_at: "2026-09-13T11:44:59Z" }, "request_not_fresh"],
    [{ created_at: "2026-09-13T12:01:01Z" }, "request_not_fresh"],
    [{ created_at: "invalid" }, "request_not_fresh"],
    [{ source_type: "truck_planner" }, "unsupported_source"],
  ])("rejects ineligible request %s", async (changes, reason) => {
    const { client } = mockClient({ transport_requests: [{ ...request, ...changes }] });
    expect(await sendTransportRequestEmail(client, serviceId, requestId)).toMatchObject({ reason });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it.each(["transport_requests", "jobs", "profiles", "transport_request_items"])("fails closed on %s query errors", async (table) => {
    const { client } = mockClient({}, table);
    expect(await sendTransportRequestEmail(client, serviceId, requestId)).toMatchObject({ reason: "data_unavailable" });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("skips nonexistent requests and missing requester/job records", async () => {
    for (const table of ["transport_requests", "jobs", "profiles"]) {
      const { client } = mockClient({ [table]: [] });
      expect(await sendTransportRequestEmail(client, serviceId, requestId)).toMatchObject({ reason: table === "transport_requests" ? "request_not_found" : "data_unavailable" });
    }
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("ignores production/non-logistics admins and skips invalid or absent emails", async () => {
    const { client } = mockClient({ profiles: [requester,
      { email: "production@example.com", department: "production", role: "admin" },
      ...[null, "", "broken", "a@@example.com", "a@bad..com", "Name <a@example.com>", "a\nb@example.com"].map((email) => ({ email, department: "logistics" })),
    ] });
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toMatchObject({ reason: "no_recipients" });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it.each(["BREVO_API_KEY", "BREVO_FROM"])("skips when %s is not configured", async (missing) => {
    vi.stubGlobal("Deno", { env: { get: (key: string) => key === missing ? undefined : "configured@example.com" } });
    expect(await sendTransportRequestEmail(mockClient().client, creatorId, requestId)).toMatchObject({ reason: "not_configured" });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("deduplicates normalized logistics recipients, isolates messages and uses stable per-recipient UUID keys", async () => {
    const { client } = mockClient({ profiles: [requester, ...[" LOG@example.com ", "log@example.com", "other@example.com"].map((email) => ({ email, department: "logistics" }))] });
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toMatchObject({ sent: 2 });
    const first = payload(); const second = payload(1);
    expect(first.to).toEqual([{ email: "log@example.com" }]);
    expect(second.to).toEqual([{ email: "other@example.com" }]);
    expect(first).not.toHaveProperty("cc"); expect(first).not.toHaveProperty("bcc");
    expect(first.htmlContent).not.toContain("other@example.com");
    expect(first.headers.idempotencyKey).toMatch(/^[\da-f]{8}-[\da-f]{4}-8[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(first.headers.idempotencyKey).not.toBe(second.headers.idempotencyKey);
    await sendTransportRequestEmail(client, creatorId, requestId);
    expect(payload(2).headers.idempotencyKey).toBe(first.headers.idempotencyKey);
  });

  it("bounds concurrency to four and isolates individual provider failures", async () => {
    const { client } = mockClient({ profiles: [requester, ...Array.from({ length: 9 }, (_, index) => ({ email: `log${index}@example.com`, department: "logistics" }))] });
    let active = 0; let peak = 0;
    vi.mocked(sendBrevoEmail).mockImplementation(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5)); active--;
      return new Response(null, { status: 500 });
    });
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toMatchObject({ status: "failed", failed: 9 });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it("treats only an explicit provider idempotency duplicate as skipped", async () => {
    const { client } = mockClient();
    vi.mocked(sendBrevoEmail).mockResolvedValueOnce(new Response(JSON.stringify({ code: "duplicate_parameter", message: "Email for the idempotency key has already been processed" }), { status: 400 }));
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toMatchObject({ status: "skipped", skipped: 1, failed: 0 });
    vi.mocked(sendBrevoEmail).mockResolvedValueOnce(new Response(JSON.stringify({ code: "duplicate_parameter", message: "duplicate recipient" }), { status: 400 }));
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toMatchObject({ status: "failed", failed: 1 });
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("private provider error"));
    expect(await sendTransportRequestEmail(client, creatorId, requestId)).toEqual({ status: "failed", sent: 0, skipped: 0, failed: 1 });
  });

  it("paginates recipients before sending", async () => {
    const { client, from } = mockClient({ profiles: [requester, ...Array.from({ length: 501 }, (_, index) => ({ email: "log@example.com", department: "logistics", id: `log-${index}` }))] });
    expect(await sendTransportRequestEmail(client, serviceId, requestId)).toMatchObject({ sent: 1 });
    const pages = from.mock.results.filter(({ value }) => value.range.mock.calls.length).map(({ value }) => value.range.mock.calls[0]);
    expect(pages).toEqual([[0, 499], [500, 999]]);
  });

  it("skips every send if recipient pagination fails after an earlier successful page", async () => {
    const { client, from } = mockClient({ profiles: [requester, ...Array.from({ length: 500 }, () => ({ email: "log@example.com", department: "logistics" }))] });
    const implementation = from.getMockImplementation()!;
    from.mockImplementation((table) => {
      const query = implementation(table);
      const originalRange = query.range.getMockImplementation()!;
      query.range.mockImplementation((start, end) => {
        if (start === 500) throw new Error("recipient query failed");
        return originalRange(start, end);
      });
      return query;
    });
    expect(await sendTransportRequestEmail(client, serviceId, requestId)).toMatchObject({ status: "skipped" });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("reports partial delivery while continuing after a provider failure", async () => {
    const { client } = mockClient({ profiles: [requester, ...["log@example.com", "other@example.com"].map((email) => ({ email, department: "logistics" }))] });
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("timeout"));
    expect(await sendTransportRequestEmail(client, serviceId, requestId)).toEqual({ status: "partial", sent: 1, failed: 1, skipped: 0 });
  });

  it("sends a fresh subrental request", async () => {
    const { client } = mockClient({ transport_requests: [{ ...request, source_type: "subrental" }] });
    expect(await sendTransportRequestEmail(client, serviceId, requestId)).toMatchObject({ sent: 1 });
    expect(payload().htmlContent).toContain("Subalquiler");
  });

  it("formats null dates, fallback timezones, legacy vehicles and subrentals safely", () => {
    const content = formatTransportRequestEmail({ ...request, source_type: "subrental", needed_at: null, description: null, note: null, transport_type: "6m" }, { ...job, timezone: "invalid", start_time: null, end_time: "invalid" }, requester, []);
    expect(content.htmlContent).toContain("No especificada");
    expect(content.htmlContent).not.toContain("Invalid Date");
    expect(content.htmlContent).toContain("Europe/Madrid");
    expect(content.htmlContent).toContain("Subalquiler");
    expect(content.htmlContent).toContain("Camión 6 m");
  });
});
