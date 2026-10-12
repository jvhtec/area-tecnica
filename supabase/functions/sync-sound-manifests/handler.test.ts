import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serve: vi.fn(), createClient: vi.fn(), fetch: vi.fn(), log: vi.fn() }));
vi.mock("https://deno.land/std@0.224.0/http/server.ts", () => ({ serve: mocks.serve }));
vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: mocks.createClient }));
vi.mock("../_shared/flexFetch.ts", () => ({ fetchWithRetry: mocks.fetch }));
vi.mock("../_shared/structuredLogger.ts", () => ({ logEvent: mocks.log }));
await import("./index");
const handler = mocks.serve.mock.calls[0][0] as (request: Request) => Promise<Response>;
const job = { id: "11111111-1111-4111-8111-111111111111", title: "Concierto", start_time: "2026-10-12T18:00:00Z", status: "confirmed" };
const sheet = "22222222-2222-4222-8222-222222222222";
const prep = "33333333-3333-4333-8333-333333333333";
const ship = "44444444-4444-4444-8444-444444444444";
const prepared = "70b2de6c-aee8-11df-b8d5-00e08175e43e";
const prefix = `flex-reports/sound-manifests/${job.id}/${sheet}`;
type Result = { data?: unknown; error?: { message: string } | null };
const request = (authorization = "Bearer fixture-service", body?: unknown) => new Request("https://example.test", { method: "POST", headers: { authorization }, body: body === undefined ? undefined : JSON.stringify(body) });

function database(previous: { id: string; file_path: string }[] = [], options: {
  insertError?: boolean; deleteError?: boolean; releaseError?: boolean; claim?: boolean;
  references?: { file_path: string }[]; referencesError?: boolean;
  sources?: { element_id: string; folder_type: string }[];
  jobs?: typeof job[];
} = {}) {
  const events: string[] = [];
  const queue: Result[] = [
    { data: options.jobs ?? [job] }, { data: options.sources ?? [{ element_id: sheet, folder_type: "pull_sheet" }] }, { data: previous },
  ];
  const queries: { table: string; filters: unknown[][] }[] = [];
  const inserts: Record<string, unknown>[] = [];
  const remove = vi.fn(async (_paths: string[]) => { events.push("remove"); return { error: null }; });
  const db = {
    from: vi.fn((table: string) => {
      let result = queue.shift();
      const filters: unknown[][] = [];
      queries.push({ table, filters });
      const query = {
        select: vi.fn((columns: string) => {
          if (columns === "file_path") {
            events.push("references");
            result = { data: options.references ?? [], error: options.referencesError ? { message: "reference lookup failed" } : null };
          }
          return query;
        }), gte: vi.fn((...args: unknown[]) => {
          filters.push(["gte", ...args]);
          if (table === "jobs" && Array.isArray(result?.data)) result = { ...result, data: result.data.filter((row) => row.start_time >= String(args[1])) };
          return query;
        }), lte: vi.fn((...args: unknown[]) => {
          filters.push(["lte", ...args]);
          if (table === "jobs" && Array.isArray(result?.data)) result = { ...result, data: result.data.filter((row) => row.start_time <= String(args[1])) };
          return query;
        }),
        order: vi.fn(() => query), limit: vi.fn(() => query),
        eq: vi.fn((...args: unknown[]) => {
          filters.push(["eq", ...args]);
          if (table === "flex_folders" && args[0] === "folder_type" && Array.isArray(result?.data)) {
            result = { ...result, data: result.data.filter((row) => row.folder_type === args[1]) };
          }
          return query;
        }),
        like: vi.fn((...args: unknown[]) => { filters.push(["like", ...args]); return query; }),
        insert: vi.fn((row: Record<string, unknown>) => {
          events.push("insert"); inserts.push(row);
          result = { data: options.insertError ? null : { id: "new-document" }, error: options.insertError ? { message: "insert failed" } : null };
          return query;
        }),
        delete: vi.fn(() => { events.push("delete"); result = { error: options.deleteError ? { message: "delete failed" } : null }; return query; }),
        in: vi.fn((...args: unknown[]) => {
          filters.push(["in", ...args]);
          if (table === "flex_folders" && args[0] === "folder_type" && Array.isArray(args[1]) && Array.isArray(result?.data)) {
            const types = args[1];
            result = { ...result, data: result.data.filter((row) => types.includes(row.folder_type)) };
          }
          return query;
        }),
        single: vi.fn(async () => result),
        then: (resolve: (result: Result | undefined) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    }),
    rpc: vi.fn(async (name: string) => {
      events.push(name);
      return name === "claim_sound_manifest_slot" ? { data: options.claim ?? true, error: null }
        : { error: options.releaseError ? { message: "release failed" } : null };
    }),
    storage: { from: vi.fn(() => ({
      upload: vi.fn(async () => { events.push("upload"); return { error: null }; }),
      remove,
    })) },
  };
  mocks.createClient.mockReturnValue(db);
  return { db, events, inserts, queries, queue, remove };
}

function flex(status = prepared, shippedStatus: string | null = null) {
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes("warehouse-state")) return Response.json({ prepManifestId: prep, shipManifestId: shippedStatus ? ship : null });
    if (url.includes("header-data")) return Response.json({ statusId: { data: { id: url.includes(ship) ? shippedStatus : status } }, documentNumber: { data: "MS-0042" } });
    return new Response("%PDF-1.7\nfixture\n%%EOF");
  });
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-12T12:00:00Z"));
  vi.stubGlobal("Deno", { env: { get: (name: string) => ({ SUPABASE_SERVICE_ROLE_KEY: "fixture-service", SUPABASE_URL: "https://project.supabase.co", X_AUTH_TOKEN: "fixture-flex" })[name] } });
  flex();
});
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Sound manifest worker", () => {
  it.each([["comercial_presupuesto", false], ["dryhire_presupuesto", false], ["comercial_presupuesto", true], ["dryhire_presupuesto", true]] as const)("discovers an unregistered Pull Sheet beneath Sound %s with a mapped copy: %s", async (folderType, mapped) => {
    const quote = "55555555-5555-4555-8555-555555555555";
    const fixture = database([], { sources: [{ element_id: quote, folder_type: folderType }, ...(mapped ? [{ element_id: sheet, folder_type: "pull_sheet" }] : [])] });
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.includes("/tree")) return Response.json({ nodeId: job.id, children: [
        { nodeId: quote, children: [{ nodeId: sheet, parentId: quote, domainId: "equipment-list", deleted: false }] },
        { nodeId: ship, parentId: job.id, domainId: "equipment-list" },
      ] });
      if (url.includes("key-info")) return Response.json({ elementId: sheet, definitionId: "a220432c-af33-11df-b8d5-00e08175e43e", isManifest: false, deleted: false });
      return original(url);
    });
    expect(await (await handler(request())).json()).toMatchObject({ checked: 1, published: 1, errors: [] });
    expect(fixture.queries[1].filters).toEqual([
      ["eq", "job_id", job.id], ["eq", "department", "sound"],
      ["in", "folder_type", ["pull_sheet", "comercial_presupuesto", "dryhire_presupuesto"]],
    ]);
    expect(mocks.fetch.mock.calls.filter(([url]) => url.includes("warehouse-state")).map(([url]) => url))
      .toEqual([`https://sectorpro.flexrentalsolutions.com/f5/api/equipment-list/warehouse-state/${sheet}`]);
  });

  it("validates a job-scoped PDF dry run without claiming a lease or changing documents", async () => {
    const fixture = database();
    expect(await (await handler(request(undefined, { job_id: job.id, dry_run: true }))).json())
      .toMatchObject({ dry_run: true, checked: 1, published: 0, previews: [{ job_id: job.id, sheet_id: sheet, manifest_id: prep, pdf_bytes: new TextEncoder().encode("%PDF-1.7\nfixture\n%%EOF").length }] });
    expect(fixture.queries[0].filters).toContainEqual(["eq", "id", job.id]);
    expect(fixture.queries[0].filters).toContainEqual(["gte", "start_time", "2026-10-10T12:00:00.000Z"]);
    expect(fixture.queries[0].filters).toContainEqual(["lte", "start_time", "2026-10-14T12:00:00.000Z"]);
    expect(fixture.queries).toHaveLength(2);
    expect(fixture.events).toEqual([]);
    expect(fixture.db.rpc).not.toHaveBeenCalled();
    expect(fixture.db.storage.from).not.toHaveBeenCalled();
  });

  it.each([{ job_id: "invalid" }, { dry_run: "true" }, { element_id: ship }, null, []])("rejects invalid run options before any database or Flex access: %j", async (body) => {
    expect((await handler(request(undefined, body))).status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("deduplicates repeated mapped Pull Sheets", async () => {
    database([], { sources: [1, 2].map(() => ({ element_id: sheet, folder_type: "pull_sheet" })) });
    expect(await (await handler(request())).json()).toMatchObject({ checked: 1, published: 1 });
  });

  it("preserves the installed cron request contract", async () => {
    database();
    expect(await (await handler(request(undefined, { triggered_by: "pg_cron" }))).json()).toMatchObject({ published: 1, errors: [] });
  });

  it("rejects malformed or oversized requests before discovery", async () => {
    for (const [body, status] of [["{", 400], [" ".repeat(1025), 413]] as const) {
      expect((await handler(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer fixture-service" }, body }))).status).toBe(status);
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("processes a mapped sheet while reporting a stale quote discovery failure", async () => {
    const quote = "55555555-5555-4555-8555-555555555555";
    database([], { sources: [{ element_id: quote, folder_type: "comercial_presupuesto" }, { element_id: sheet, folder_type: "pull_sheet" }] });
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string) => url.includes("/tree") ? new Response("Not found", { status: 404 }) : original(url));
    const response = await handler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ checked: 1, published: 1, errors: [job.id] });
  });

  it.each(["2026-10-10T11:59:59Z", "2026-10-14T12:00:01Z"])("does not fetch Flex for a scoped job outside the window: %s", async (startTime) => {
    const fixture = database([], { jobs: [{ ...job, start_time: startTime }] });
    expect(await (await handler(request(undefined, { job_id: job.id, dry_run: true }))).json()).toMatchObject({ checked: 0, previews: [] });
    expect(fixture.queries).toHaveLength(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("denies non-service callers before database or Flex access", async () => {
    expect((await handler(request("Bearer fixture-user"))).status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("fails closed on an unknown manifest status", async () => {
    const fixture = database(); flex("unknown");
    const response = await handler(request());
    expect(await response.json()).toMatchObject({ pending: 1, published: 0, errors: [] });
    expect(fixture.db.rpc).not.toHaveBeenCalled();
    expect(fixture.inserts).toEqual([]);
  });

  it("publishes the shipping manifest before retiring the prepared document in the same slot", async () => {
    const fixture = database([{ id: "prepared-document", file_path: `${prefix}/old.pdf` }]);
    flex(prepared, "4dc8c4ec-aee9-11df-b8d5-00e08175e43e");
    const response = await handler(request());
    expect(await response.json()).toMatchObject({ published: 1, errors: [] });
    expect(mocks.fetch.mock.calls.find(([url]) => url.includes("generate-pdf"))?.[0]).toContain(`PROJECT_ELEMENT_ID=${ship}`);
    expect(fixture.queries[2].filters).toContainEqual(["like", "file_path", `${prefix}/%`]);
    expect(fixture.inserts[0]).toMatchObject({ job_id: job.id, visible_to_tech: true, read_only: true, uploaded_by: null });
    expect(fixture.events).toEqual(["claim_sound_manifest_slot", "upload", "insert", "delete", "references", "remove", "release_sound_manifest_slot"]);
  });

  it("falls back to prepared when the shipping status is not eligible", async () => {
    database(); flex(prepared, "unknown");
    await handler(request());
    expect(mocks.fetch.mock.calls.find(([url]) => url.includes("generate-pdf"))?.[0]).toContain(`PROJECT_ELEMENT_ID=${prep}`);
  });

  it("leaves an active publication alone when its lease cannot be claimed", async () => {
    const fixture = database([], { claim: false });
    expect(await (await handler(request())).json()).toMatchObject({ pending: 1, published: 0 });
    expect(fixture.events).toEqual(["claim_sound_manifest_slot"]);
    expect(mocks.fetch.mock.calls.some(([url]) => url.includes("generate-pdf"))).toBe(false);
  });

  it("does not upload or insert unchanged content, and releases the lease", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nfixture\n%%EOF");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
    const fixture = database([{ id: "current", file_path: `${prefix}/${hash}.pdf` }]);
    expect(await (await handler(request())).json()).toMatchObject({ unchanged: 1, published: 0 });
    expect(fixture.events).toEqual(["claim_sound_manifest_slot", "release_sound_manifest_slot"]);
  });

  it("keeps the previous document when insertion fails and reports a retryable failure", async () => {
    const fixture = database([{ id: "previous", file_path: `${prefix}/old.pdf` }], { insertError: true });
    const response = await handler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ published: 0, errors: [job.id] });
    expect(fixture.events).toEqual(["claim_sound_manifest_slot", "upload", "insert", "release_sound_manifest_slot"]);
  });

  it("reports predecessor cleanup failures instead of silently claiming success", async () => {
    const fixture = database([{ id: "previous", file_path: `${prefix}/old.pdf` }], { deleteError: true });
    expect((await handler(request())).status).toBe(500);
    expect(fixture.events).not.toContain("remove");
    expect(fixture.events.at(-1)).toBe("release_sound_manifest_slot");
    expect(mocks.log).toHaveBeenCalledWith("warn", "sound_manifest_sync.completed", expect.objectContaining({ failed: 1 }));
  });

  it("rejects non-PDF reports without publishing or retiring anything", async () => {
    const fixture = database();
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string) => url.includes("generate-pdf") ? new Response("<html>error</html>") : original(url));
    expect((await handler(request())).status).toBe(500);
    expect(fixture.events).toEqual(["claim_sound_manifest_slot", "release_sound_manifest_slot"]);
  });

  it("preserves shared predecessor PDFs and removes only unreferenced paths after replacement", async () => {
    const shared = `${prefix}/shared.pdf`, orphan = `${prefix}/orphan.pdf`;
    const fixture = database([{ id: "shared", file_path: shared }, { id: "orphan", file_path: orphan }], { references: [{ file_path: shared }] });
    expect(await (await handler(request())).json()).toMatchObject({ published: 1, errors: [] });
    expect(fixture.remove).toHaveBeenCalledExactlyOnceWith([orphan]);
    expect(fixture.queries.at(-1)?.filters).toEqual([["in", "file_path", [shared, orphan]]]);
    expect(fixture.events.indexOf("references")).toBeGreaterThan(fixture.events.indexOf("delete"));
  });

  it("preserves shared stale PDFs during unchanged-version cleanup", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nfixture\n%%EOF");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
    const shared = `${prefix}/shared.pdf`;
    const fixture = database([{ id: "current", file_path: `${prefix}/${hash}.pdf` }, { id: "shared", file_path: shared }], { references: [{ file_path: shared }] });
    expect(await (await handler(request())).json()).toMatchObject({ unchanged: 1, errors: [] });
    expect(fixture.remove).not.toHaveBeenCalled();
    expect(fixture.queries.at(-1)?.filters).toEqual([["in", "file_path", [shared]]]);
    expect(fixture.events).toEqual(["claim_sound_manifest_slot", "delete", "references", "release_sound_manifest_slot"]);
  });

  it("fails closed on a reference lookup error without deleting Storage objects", async () => {
    const fixture = database([{ id: "previous", file_path: `${prefix}/old.pdf` }], { referencesError: true });
    expect((await handler(request())).status).toBe(500);
    expect(fixture.remove).not.toHaveBeenCalled();
    expect(fixture.events.at(-1)).toBe("release_sound_manifest_slot");
  });
});
