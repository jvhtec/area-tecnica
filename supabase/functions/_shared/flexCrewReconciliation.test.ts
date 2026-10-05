import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reconcileFlexCrew } from "./flexCrewReconciliation.ts";

type Row = Record<string, unknown>;
type Desired = { crew_call_id: string; technician_id: string; resource_id: string | null; department: "sound" | "lights"; role: string };
type Current = { crew_call_id: string; technician_id: string; resource_id: string | null; line_item_id: string | null };
type RpcCall = { name: string; args: Row };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const desired = (overrides: Partial<Desired> = {}): Desired => ({
  crew_call_id: "crew", technician_id: "tech", resource_id: "resource", department: "sound", role: "FOH-T", ...overrides,
});
const mapped = (overrides: Partial<Current> = {}): Current => ({
  crew_call_id: "crew", technician_id: "tech", resource_id: "resource", line_item_id: "line", ...overrides,
});
const contact = (id = "line", resourceId = "resource"): Row => ({ id, resourceId, managedResourceLineItemType: "contact" });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
function refusal(code: string, message: string) { return json({ code, message, details: null, hint: null }, 400); }

// Behavioral server behind the real Supabase client. This independently models
// durable ownership and provider effects, rather than mocking helper internals.
// SQL authorization/projection correctness is covered by the prime's DB tests.
class Server {
  desired: Desired[] = [];
  current: Current[] = [];
  rows: Row[] = [];
  state: "idle" | "busy" | "uncertain" = "idle";
  owner: string | null = null;
  outstanding: Row | null = null;
  journal = new Map<string, Current>();
  aliases = ["crew", "alias"];
  rpcCalls: RpcCall[] = [];
  providerCalls: { method: string; url: URL; init: RequestInit }[] = [];
  beforeRpc?: (call: RpcCall) => Promise<Response | undefined> | Response | undefined;
  afterRpc?: (call: RpcCall, response: Response) => Promise<Response> | Response;
  providerHook?: (url: URL, init: RequestInit) => Promise<Response | undefined> | Response | undefined;
  sequence = 0;
  get token() { return JSON.stringify({ desired: this.desired, aliases: this.aliases }); }
  newClient() {
    return createClient("https://rpc.test", "service-test-key", {
      global: { fetch: (input, init) => this.fetchRpc(input, init) },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  client = this.newClient();
  run(department: "sound" | "lights" = "sound") {
    return reconcileFlexCrew(this.newClient(), "job", department, "flex-test-token", { fetch: this.fetchProvider });
  }
  calls(name: string) { return this.rpcCalls.filter((call) => call.name === name); }
  get mutations() { return this.providerCalls.filter((call) => call.method !== "GET"); }
  async fetchRpc(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const name = new URL(String(input)).pathname.split("/").pop()!;
    const args = JSON.parse(String(init?.body)) as Row;
    const call = { name, args };
    this.rpcCalls.push(call);
    expect(init?.method).toBe("POST");
    const before = await this.beforeRpc?.(call);
    if (before) return before;
    let response: Response;
    if (name === "claim_flex_crew_reconciliation") {
      expect(args).toEqual({ p_job_id: "job", p_department: expect.stringMatching(/^(sound|lights)$/) });
      if (this.state !== "idle") response = refusal("55P03", "flex_crew_reconciliation_busy");
      else {
        this.state = "busy";
        this.owner = `owner-${++this.sequence}`;
        this.journal = new Map(this.current.flatMap(c => c.line_item_id ? [[c.line_item_id, { ...c }]] : []));
        response = json({ flex_element_id: "element", owner_token: this.owner });
      }
    } else if (args.p_element !== "element" || args.p_owner !== this.owner || this.state !== "busy") {
      response = refusal("55000", "invalid owner");
    } else if (name === "settle_flex_crew_add") {
      if (this.outstanding?.kind !== "add" || this.outstanding.crew_call_id !== args.p_crew_call
        || this.outstanding.technician_id !== args.p_technician || !this.aliases.includes(String(args.p_crew_call))) {
        response = refusal("55000", "invalid add settlement");
      } else {
        this.current = this.current.filter(c => c.crew_call_id !== args.p_crew_call || c.technician_id !== args.p_technician);
        this.current.push({ crew_call_id: String(args.p_crew_call), technician_id: String(args.p_technician),
          line_item_id: String(args.p_line_item), resource_id: this.desired.find(d => d.crew_call_id === args.p_crew_call && d.technician_id === args.p_technician)?.resource_id ?? null });
        this.outstanding = null;
        this.journal.set(String(args.p_line_item), { ...this.current.at(-1)! });
        response = new Response(null, { status: 204 });
      }
    } else if (name === "settle_flex_crew_operation") {
      if (!this.outstanding) response = refusal("55000", "no operation");
      else {
        if (args.p_uncertain) this.state = "uncertain";
        else this.outstanding = null;
        response = new Response(null, { status: 204 });
      }
    } else if (this.outstanding) {
      response = refusal("55000", "operation outstanding");
    } else if (name === "read_flex_crew_reconciliation") {
      expect(args).toEqual({ p_element: "element", p_owner: this.owner });
      response = json({ state_token: this.token, desired: this.desired, current: this.current, owned_contacts: [...this.journal.values()] });
    } else if (name === "admit_flex_crew_operation") {
      if (args.p_state_token !== this.token) response = refusal("P0409", "Flex desired state changed");
      else {
        const operation = args.p_operation as Row;
        expect(operation).toEqual({ kind: expect.stringMatching(/^(add|remove|role)$/), url: expect.any(String), method: expect.stringMatching(/^(POST|DELETE)$/), body: expect.toBeOneOf([null, expect.any(String)]), crew_call_id: expect.any(String), technician_id: expect.any(String) });
        this.outstanding = operation;
        response = new Response(null, { status: 204 });
      }
    } else if (name === "write_flex_crew_mapping") {
      expect(Object.keys(args).sort()).toEqual(["p_crew_call", "p_element", "p_line_item", "p_owner", "p_technician"]);
      if (!this.aliases.includes(String(args.p_crew_call))) response = refusal("P0409", "crew mapping changed");
      else {
        this.current = this.current.filter((c) => c.crew_call_id !== args.p_crew_call || c.technician_id !== args.p_technician);
        if (args.p_line_item != null) this.current.push({
          crew_call_id: String(args.p_crew_call), technician_id: String(args.p_technician), line_item_id: String(args.p_line_item),
          resource_id: this.desired.find((d) => d.crew_call_id === args.p_crew_call && d.technician_id === args.p_technician)?.resource_id ?? null,
        });
        if (args.p_line_item != null) this.journal.set(String(args.p_line_item), { ...this.current.at(-1)! });
        response = new Response(null, { status: 204 });
      }
    } else if (name === "release_flex_crew_reconciliation") {
      if (args.p_state_token == null && this.journal.size) response = refusal("55000", "Flex contact ownership requires verified reconciliation");
      else if (args.p_state_token != null && args.p_state_token !== this.token) response = refusal("P0409", "Flex desired state changed");
      else {
        this.state = "idle";
        this.owner = null;
        this.journal.clear();
        response = new Response(null, { status: 204 });
      }
    } else throw new Error(`Unexpected RPC ${name}`);
    return this.afterRpc ? await this.afterRpc(call, response) : response;
  }
  fetchProvider: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    this.providerCalls.push({ method, url, init });
    expect(url.origin).toBe("https://sectorpro.flexrentalsolutions.com");
    expect(init.redirect).toBe("error");
    expect(new Headers(init.headers).get("X-Auth-Token")).toBe("flex-test-token");
    if (method !== "GET") {
      expect(this.state).toBe("busy");
      expect(this.outstanding?.url).toBe(String(url));
    }
    const intercepted = await this.providerHook?.(url, init);
    if (intercepted) return intercepted;
    if (method === "GET") {
      expect(url.pathname).toBe("/f5/api/line-item/element/row-data/");
      expect(url.searchParams.getAll("codeList")).toEqual(["contact", "business-role"]);
      return json(this.rows);
    }
    if (url.pathname.includes("/add-resource/")) {
      expect(method).toBe("POST");
      expect(new URLSearchParams(String(init.body)).get("managedResourceLineItemType")).toBe("contact");
      const resource = decodeURIComponent(url.pathname.split("/").pop()!);
      const line = `line-${++this.sequence}`;
      this.rows.push(contact(line, resource));
      return json({ addedResourceLineIds: [line] });
    }
    if (method === "DELETE") {
      const id = decodeURIComponent(url.pathname.split("/").pop()!);
      expect(id).not.toBe("line-item");
      this.rows = this.rows.filter((r) => r.id !== id);
      return new Response(null, { status: 204 });
    }
    expect(url.pathname).toBe("/f5/api/line-item/element/row-data/");
    const payload = JSON.parse(String(init.body)) as Row;
    expect(payload.fieldType).toBe("business-role");
    const row = this.rows.find((r) => r.id === payload.lineItemId);
    expect(row).toBeDefined();
    row!["business-role"] = payload.payloadValue;
    return json({ success: true });
  };
}

afterEach(() => vi.useRealTimers());

describe("current-state Flex crew reconciliation", () => {
  it("a delayed historical add removes a now-cleared mapped role, without touching unknown contacts", async () => {
    const server = new Server();
    server.current = [mapped()];
    server.rows = [contact(), contact("unknown", "outsider"), { id: "equipment", resourceId: "gear", type: "inventory" }];
    const summary = await server.run(); // Old intent cannot be passed to the helper.
    expect(summary).toMatchObject({ added: 0, removed: 1, kept: 0, rolesSet: 0 });
    expect(summary.diagnostics).toEqual([expect.stringContaining("Unmapped Flex contact unknown retained")]);
    expect(server.rows.map((r) => r.id)).toEqual(["unknown", "equipment"]);
    expect(server.current).toEqual([]);
    expect(server.mutations.map((r) => r.method)).toEqual(["DELETE"]);
  });

  it("a delayed historical remove keeps current explicit membership, including soft decline", async () => {
    const server = new Server();
    server.desired = [desired()]; // Projection still includes the explicit role on soft decline.
    server.current = [mapped()];
    server.rows = [contact()];
    const summary = await server.run();
    expect(summary).toEqual({ added: 0, removed: 0, kept: 1, rolesSet: 1, diagnostics: [] });
    expect(server.mutations.map((r) => JSON.parse(String(r.init.body)).fieldType)).toEqual(["business-role"]);
    expect(server.rows).toHaveLength(1);
  });

  it("deleted tour membership and excluded dryhire entries remain absent when the projection is empty", async () => {
    const server = new Server();
    server.rows = [contact()];
    server.current = [mapped()];
    await server.run();
    expect(server.rows).toEqual([]);
    expect(server.mutations).toHaveLength(1);
    expect(server.calls("admit_flex_crew_operation")[0].args.p_operation).toMatchObject({ kind: "remove" });
  });

  it("unions physical aliases, deduplicates one provider resource and maps each local membership", async () => {
    const server = new Server();
    server.desired = [desired(), desired({ crew_call_id: "alias", technician_id: "other-tech" })];
    const summary = await server.run();
    expect(summary).toEqual({ added: 1, removed: 0, kept: 0, rolesSet: 1, diagnostics: [] });
    expect(server.mutations).toHaveLength(2);
    expect(new Set(server.current.map((c) => c.line_item_id)).size).toBe(1);
    expect(server.current.map((c) => c.crew_call_id)).toEqual(["crew", "alias"]);
    expect(server.calls("release_flex_crew_reconciliation").at(-1)?.args.p_state_token).toBe(server.token);
  });

  it("does not remove a stale local alias while another alias still desires its physical contact", async () => {
    const server = new Server();
    server.current = [mapped()];
    server.rows = [contact()];
    server.desired = [desired({ crew_call_id: "alias" })];
    expect(await server.run()).toMatchObject({ added: 0, removed: 0, kept: 1 });
    expect(server.current).toEqual([mapped({ crew_call_id: "alias" })]);
    expect(server.mutations.every((r) => r.method === "POST")).toBe(true);
  });

  it("fails before any mutation for conflicting roles on the same resource", async () => {
    const server = new Server();
    server.desired = [desired(), desired({ crew_call_id: "alias", role: "FOH-R" })];
    await expect(server.run()).rejects.toThrow("Conflicting desired roles");
    expect(server.mutations).toEqual([]);
    expect(server.state).toBe("idle");
    expect(server.calls("release_flex_crew_reconciliation")[0].args.p_state_token).toBeNull();
  });

  it("adds once, verifies using a fresh GET, then settles and maps before setting the supported role", async () => {
    const server = new Server();
    server.desired = [desired()];
    server.beforeRpc = (call) => {
      if (call.name === "settle_flex_crew_add") {
        expect(server.providerCalls.filter((r) => r.method === "GET")).toHaveLength(2);
        expect(server.rows[0].resourceId).toBe("resource");
        expect(server.current).toEqual([]);
      }
      return undefined;
    };
    await server.run();
    expect(server.calls("settle_flex_crew_add")).toHaveLength(1);
    expect(server.calls("settle_flex_crew_operation").map((call) => call.args.p_uncertain)).toEqual([false]);
    expect(server.current[0].line_item_id).toBe(server.rows[0].id);
  });

  it.each(["resourceId", "id", "nestedResourceId"])("discovers an existing contact using %s and avoids another add", async (shape) => {
    const server = new Server();
    server.desired = [desired()];
    server.rows = [shape === "resourceId" ? contact() : {
      id: "line", type: "contact", resource: shape === "id" ? { id: "resource" } : { resourceId: "resource" },
    }];
    expect(await server.run()).toMatchObject({ added: 0, kept: 1 });
    expect(server.mutations).toHaveLength(1);
    expect(server.current[0].line_item_id).toBe("line");
  });

  it("updates a changed resource instead of preserving a stale technician line", async () => {
    const server = new Server();
    server.desired = [desired({ resource_id: "new-resource" })];
    server.current = [mapped({ resource_id: "new-resource" })];
    server.rows = [contact()];
    expect(await server.run()).toMatchObject({ added: 1, removed: 1 });
    expect(server.rows[0].resourceId).toBe("new-resource");
    expect(server.current[0].line_item_id).toBe(server.rows[0].id);
  });

  it("missing profile resource does not suppress stale mapped line removal", async () => {
    const server = new Server();
    server.current = [mapped({ resource_id: null })];
    server.rows = [contact()];
    expect(await server.run()).toMatchObject({ removed: 1 });
    expect(server.rows).toEqual([]);
  });

  it("a desired unmapped technician without a resource is a diagnostic skip", async () => {
    const server = new Server();
    server.desired = [desired({ resource_id: null })];
    expect(await server.run()).toMatchObject({ added: 0, rolesSet: 0, diagnostics: [expect.stringContaining("no Flex resource")] });
    expect(server.mutations).toEqual([]);
    expect(server.state).toBe("idle");
  });

  it("a desired mapped technician without a profile resource retains its verified contact", async () => {
    const server = new Server();
    server.desired = [desired({ resource_id: null })];
    server.current = [mapped({ resource_id: null })];
    server.rows = [contact()];
    expect(await server.run()).toMatchObject({ added: 0, removed: 0, kept: 1, rolesSet: 1 });
    expect(server.rows).toHaveLength(1);
  });

  it("refuses a stale mapping with no externally discoverable identity", async () => {
    const server = new Server();
    server.current = [mapped({ resource_id: null, line_item_id: null })];
    await expect(server.run()).rejects.toThrow("Missing identity");
    expect(server.current).toHaveLength(1);
    expect(server.mutations).toEqual([]);
  });

  it("discovers a stale mapped resource when its local line ID was not persisted", async () => {
    const server = new Server();
    server.current = [mapped({ line_item_id: null })];
    server.rows = [contact()];
    expect(await server.run()).toMatchObject({ removed: 1 });
    expect(server.rows).toEqual([]);
  });

  it("clears a proven absent local line and remaps an existing resource without duplicate POST", async () => {
    const server = new Server();
    server.current = [mapped({ line_item_id: "absent" })];
    server.desired = [desired()];
    server.rows = [contact()];
    expect(await server.run()).toMatchObject({ added: 0, removed: 0, kept: 1 });
    expect(server.current[0].line_item_id).toBe("line");
    expect(server.mutations).toHaveLength(1);
  });

  it("reports unsupported lights role dictionaries while preserving crew", async () => {
    const server = new Server();
    server.desired = [desired({ department: "lights", role: "LX-T" })];
    expect(await server.run("lights")).toMatchObject({ added: 1, rolesSet: 0, diagnostics: [expect.stringContaining("not configured")] });
    expect(server.mutations).toHaveLength(1);
  });
});

describe("durable ownership and fresh state", () => {
  it("two independent workers cannot overlap while one is paused; settled work rereads new core state", async () => {
    const server = new Server();
    server.desired = [desired()];
    const entered = deferred<void>();
    const proceed = deferred<void>();
    server.providerHook = async (url, init) => {
      if (url.pathname.includes("add-resource") && init.method === "POST") {
        entered.resolve();
        await proceed.promise;
      }
      return undefined;
    };
    const first = server.run();
    await entered.promise;
    server.desired = []; // Core role clear commits independently while Flex is paused.
    await expect(server.run()).rejects.toThrow("busy");
    expect(server.mutations).toHaveLength(1);
    expect(server.outstanding?.kind).toBe("add");
    proceed.resolve();
    expect(await first).toMatchObject({ added: 1, removed: 1, rolesSet: 0 });
    expect(server.rows).toEqual([]);
    expect(server.current).toEqual([]);
    expect(server.state).toBe("idle");
  });

  it("a stale admission token causes a fresh projection, never the old external mutation", async () => {
    const server = new Server();
    server.desired = [desired()];
    let changed = false;
    server.beforeRpc = (call) => {
      if (call.name === "admit_flex_crew_operation" && !changed) { changed = true; server.desired = []; }
      return undefined;
    };
    expect(await server.run()).toMatchObject({ added: 0, removed: 0 });
    expect(server.mutations).toEqual([]);
    expect(server.calls("admit_flex_crew_operation")).toHaveLength(1);
    expect(server.calls("read_flex_crew_reconciliation").length).toBeGreaterThan(1);
  });

  it("the final state token catches changes between last read and release", async () => {
    const server = new Server();
    let changed = false;
    server.beforeRpc = (call) => {
      if (call.name === "release_flex_crew_reconciliation" && !changed) { changed = true; server.desired = [desired()]; }
      return undefined;
    };
    expect(await server.run()).toMatchObject({ added: 1 });
    expect(server.calls("release_flex_crew_reconciliation")).toHaveLength(2);
    expect(server.calls("release_flex_crew_reconciliation")[1].args.p_state_token).toBe(server.token);
    expect(server.state).toBe("idle");
  });

  it("continuously changing core state exhausts bounded passes and releases only as an error", async () => {
    const server = new Server();
    server.beforeRpc = (call) => {
      if (call.name === "release_flex_crew_reconciliation" && call.args.p_state_token != null) {
        server.aliases.push(`changing-${server.aliases.length}`);
      }
      return undefined;
    };
    await expect(server.run()).rejects.toThrow("pass budget");
    expect(server.calls("release_flex_crew_reconciliation")).toHaveLength(9);
    expect(server.calls("release_flex_crew_reconciliation").at(-1)?.args.p_state_token).toBeNull();
    expect(server.state).toBe("idle");
  });

  it.each(["claim_flex_crew_reconciliation", "admit_flex_crew_operation"])("a committed %s with a lost transport response is never retried or released", async (name) => {
    const server = new Server();
    server.desired = [desired()];
    server.afterRpc = (call, response) => {
      if (call.name === name) throw new Error("connection reset after commit");
      return response;
    };
    await expect(server.run()).rejects.toThrow();
    expect(server.state).toBe("busy");
    expect(server.calls(name)).toHaveLength(1);
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
    expect(server.mutations).toEqual([]);
    await expect(server.run()).rejects.toThrow();
    expect(server.state).toBe("busy");
  });

  it.each(["claim_flex_crew_reconciliation", "admit_flex_crew_operation"])("a gateway 503 from %s proves no admission failure and leaves ownership retained", async (name) => {
    const server = new Server();
    server.desired = [desired()];
    server.afterRpc = (call, response) => call.name === name ? new Response("gateway", { status: 503 }) : response;
    await expect(server.run()).rejects.toThrow();
    expect(server.state).toBe("busy");
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
    expect(server.calls(name)).toHaveLength(1);
  });

  it.each(["claim_flex_crew_reconciliation", "admit_flex_crew_operation"])("a timed-out %s may complete late and cannot be released or retried", async (name) => {
    vi.useFakeTimers();
    const server = new Server();
    server.desired = [desired()];
    const entered = deferred<void>();
    const late = deferred<void>();
    server.beforeRpc = async (call) => {
      if (call.name === name) { entered.resolve(); await late.promise; }
      return undefined;
    };
    const running = server.run();
    const rejected = expect(running).rejects.toThrow();
    await entered.promise;
    await vi.advanceTimersByTimeAsync(15_001);
    await rejected;
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
    expect(server.calls(name)).toHaveLength(1);
    late.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.state).toBe("busy");
    if (name === "admit_flex_crew_operation") expect(server.outstanding?.kind).toBe("add");
    expect(server.mutations).toEqual([]);
  });

  it("stale owner admission, mapping and release all fail before touching the provider", async () => {
    const server = new Server();
    server.state = "busy";
    server.owner = "new-owner";
    const client = server.client;
    const args = { p_element: "element", p_owner: "retired-owner" };
    for (const [name, extra] of [
      ["admit_flex_crew_operation", { p_operation: { kind: "add" }, p_state_token: server.token }],
      ["write_flex_crew_mapping", { p_crew_call: "crew", p_technician: "tech", p_line_item: "rogue" }],
      ["release_flex_crew_reconciliation", { p_state_token: null }],
    ] as const) {
      expect((await client.rpc(name, { ...args, ...extra })).error?.code).toBe("55000");
    }
    expect(server.current).toEqual([]);
    expect(server.state).toBe("busy");
    expect(server.mutations).toEqual([]);
  });
});

describe("provider uncertainty and terminal failures", () => {
  it.each([202, 408, 500, 502, 503, 504])("HTTP %s quarantines a single admitted mutation without retries", async (status) => {
    const server = new Server();
    server.desired = [desired()];
    server.providerHook = (_url, init) => init.method === "POST" ? json({ pending: true }, status) : undefined;
    await expect(server.run()).rejects.toThrow("unverified");
    expect(server.state).toBe("uncertain");
    expect(server.outstanding?.kind).toBe("add");
    expect(server.mutations).toHaveLength(1);
    expect(server.calls("settle_flex_crew_operation").map((call) => call.args.p_uncertain)).toEqual([true]);
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
    expect(server.current).toEqual([]);
  });

  it("late provider completion after timeout remains quarantined, even days later with local mappings deleted", async () => {
    vi.useFakeTimers();
    const server = new Server();
    server.desired = [desired()];
    const entered = deferred<void>();
    const late = deferred<Response>();
    server.providerHook = async (_url, init) => {
      if (init.method === "POST") { entered.resolve(); return await late.promise; }
      return undefined;
    };
    const running = server.run();
    const rejected = expect(running).rejects.toThrow("unverified");
    await entered.promise;
    await vi.advanceTimersByTimeAsync(15_001);
    await rejected;
    expect(server.state).toBe("uncertain");
    server.rows.push(contact("late-line")); // Provider ignores abort and eventually commits.
    late.resolve(json({ id: "late-line" }));
    await Promise.resolve();
    server.current = [];
    vi.setSystemTime(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await expect(server.run()).rejects.toThrow("busy");
    expect(server.mutations).toHaveLength(1);
    expect(server.outstanding?.kind).toBe("add");
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
  });

  it("a lost mutation response quarantines even when the provider already inserted a contact", async () => {
    const server = new Server();
    server.desired = [desired()];
    server.providerHook = (_url, init) => {
      if (init.method === "POST") { server.rows.push(contact()); throw new Error("reset"); }
      return undefined;
    };
    await expect(server.run()).rejects.toThrow("unverified");
    expect(server.state).toBe("uncertain");
    expect(server.rows).toHaveLength(1);
    expect(server.current).toEqual([]);
    expect(server.mutations).toHaveLength(1);
  });

  it.each([200, 403])("a failed response body at HTTP %s does not settle or release", async (status) => {
    const server = new Server();
    server.desired = [desired()];
    server.providerHook = (_url, init) => init.method === "POST" ? new Response(new ReadableStream({
      start(controller) { controller.error(new Error("body interrupted")); },
    }), { status }) : undefined;
    await expect(server.run()).rejects.toThrow("unverified");
    expect(server.state).toBe("uncertain");
    expect(server.calls("settle_flex_crew_operation")[0].args.p_uncertain).toBe(true);
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
  });

  it("fully consumes a paused mutation body before settling", async () => {
    const server = new Server();
    server.desired = [desired({ department: "lights", role: "LX-T" })];
    const entered = deferred<void>();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    server.providerHook = (_url, init) => {
      if (init.method === "POST") {
        server.rows.push(contact());
        entered.resolve();
        return new Response(new ReadableStream<Uint8Array>({ start(c) { streamController = c; } }));
      }
      return undefined;
    };
    const running = server.run("lights");
    await entered.promise;
    expect(server.outstanding?.kind).toBe("add");
    expect(server.calls("settle_flex_crew_operation")).toEqual([]);
    streamController.enqueue(new TextEncoder().encode("{}"));
    streamController.close();
    expect(await running).toMatchObject({ added: 1 });
  });

  it("a hanging response body times out under the mutation budget and stays quarantined after it closes", async () => {
    vi.useFakeTimers();
    const server = new Server();
    server.desired = [desired()];
    const entered = deferred<void>();
    let body!: ReadableStreamDefaultController<Uint8Array>;
    server.providerHook = (_url, init) => {
      if (init.method === "POST") {
        server.rows.push(contact());
        entered.resolve();
        return new Response(new ReadableStream<Uint8Array>({ start(c) { body = c; } }));
      }
      return undefined;
    };
    const running = server.run();
    const rejected = expect(running).rejects.toThrow("unverified");
    await entered.promise;
    await vi.advanceTimersByTimeAsync(15_001);
    await rejected;
    body.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.state).toBe("uncertain");
    expect(server.mutations).toHaveLength(1);
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
  });

  it.each([400, 401, 403, 404, 409, 429])("an explicit HTTP %s refusal settles then releases as an error, without another format", async (status) => {
    const server = new Server();
    server.desired = [desired()];
    server.providerHook = (_url, init) => init.method === "POST" ? json({ error: "refused" }, status) : undefined;
    await expect(server.run()).rejects.toThrow(`HTTP ${status}`);
    expect(server.mutations).toHaveLength(1);
    expect(server.calls("settle_flex_crew_operation")[0].args.p_uncertain).toBe(false);
    expect(server.calls("release_flex_crew_reconciliation")[0].args.p_state_token).toBeNull();
    expect(server.state).toBe("idle");
  });

  it("supported business-role failures propagate after a verified add and map", async () => {
    const server = new Server();
    server.desired = [desired()];
    server.providerHook = (url, init) => url.pathname.endsWith("row-data/") && init.method === "POST" ? json({ error: "role" }, 403) : undefined;
    await expect(server.run()).rejects.toThrow("Flex role refused: HTTP 403");
    expect(server.current).toHaveLength(1);
    expect(server.mutations).toHaveLength(2);
    expect(server.state).toBe("busy");
    expect(server.journal.size).toBe(1);
  });

  it("failure to verify an add quarantines rather than retrying or writing a guessed line", async () => {
    const server = new Server();
    server.desired = [desired()];
    server.providerHook = (_url, init) => init.method === "POST" ? json({ id: "unproven" }) : undefined;
    await expect(server.run()).rejects.toThrow("unverified");
    expect(server.state).toBe("uncertain");
    expect(server.current).toEqual([]);
    expect(server.mutations).toHaveLength(1);
  });

  it("settlement transport ambiguity retains busy ownership even when settlement committed", async () => {
    const server = new Server();
    server.desired = [desired()];
    server.afterRpc = (call, response) => {
      if (call.name === "settle_flex_crew_add") throw new Error("settle response lost");
      return response;
    };
    await expect(server.run()).rejects.toThrow("unverified");
    expect(server.state).toBe("busy"); // Uncertain marking refuses because settlement already cleared the operation.
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
    expect(server.mutations).toHaveLength(1);
  });

  it("successful add with failed atomic mapping retains its admitted operation and excludes later workers", async () => {
    const server = new Server();
    server.desired = [desired()];
    server.beforeRpc = call => call.name === "settle_flex_crew_add" ? refusal("23503", "mapping failed") : undefined;
    await expect(server.run()).rejects.toThrow("unverified");
    expect(server.rows).toHaveLength(1);
    expect(server.current).toEqual([]);
    expect(server.state).toBe("uncertain");
    server.desired = [];
    await expect(server.run()).rejects.toThrow("flex_crew_reconciliation_busy");
    expect(server.calls("release_flex_crew_reconciliation")).toEqual([]);
  });

  it("mapping cascade after add cannot make this worker forget its owned contact", async () => {
    const server = new Server();
    server.desired = [desired()];
    let changed = false;
    server.beforeRpc = call => {
      if (call.name === "read_flex_crew_reconciliation" && server.current.length && !changed) {
        changed = true;
        server.desired = []; server.current = []; server.aliases = [];
      }
      return undefined;
    };
    expect(await server.run()).toMatchObject({ added: 1, removed: 1 });
    expect(server.rows).toEqual([]);
    expect(server.state).toBe("idle");
  });

  it("a mapping cascade followed by projection failure retains ownership and blocks a forgetful retry", async () => {
    const server = new Server();
    server.desired = [desired()];
    server.beforeRpc = call => {
      if (call.name === "read_flex_crew_reconciliation" && server.current.length) {
        server.desired = []; server.current = []; server.aliases = [];
        return refusal("55000", "projection unavailable after cascade");
      }
      return undefined;
    };
    await expect(server.run()).rejects.toThrow();
    expect(server.rows).toHaveLength(1);
    expect(server.state).toBe("busy");
    expect(server.journal.size).toBe(1);
    server.beforeRpc = undefined;
    await expect(server.run()).rejects.toThrow("flex_crew_reconciliation_busy");
  });

  it("the durable journal preserves a contact when its mapping cascades immediately after claim", async () => {
    const server = new Server();
    server.current = [mapped()]; server.rows = [contact()];
    server.afterRpc = (call, response) => {
      if (call.name === "claim_flex_crew_reconciliation") server.current = [];
      return response;
    };
    expect(await server.run()).toMatchObject({ removed: 1 });
    expect(server.rows).toEqual([]);
    expect(server.state).toBe("idle");
    expect(server.journal.size).toBe(0);
  });
});

describe("authoritative reads fail closed", () => {
  it.each([
    ["wrapped object", { items: [contact()] }], ["null", null], ["null row", [null]],
    ["missing contact identity", [{ id: "line", type: "contact" }]],
    ["missing contact line", [{ resourceId: "resource", type: "contact" }]],
    ["unproven type", [{ id: "line", resourceId: "resource" }]],
    ["duplicate line", [contact(), contact()]],
    ["duplicate resource", [contact(), contact("other")]],
    ["conflicting resource identity", [{ ...contact(), resource: { id: "different" } }]],
    ["conflicting type", [{ ...contact(), type: "inventory" }]],
    ["mapped inventory", [{ id: "line", resourceId: "resource", type: "inventory" }]],
  ])("%s cannot trigger deletion, add, or local mapping changes", async (_label, data) => {
    const server = new Server();
    server.current = [mapped()];
    server.providerHook = () => json(data);
    await expect(server.run()).rejects.toThrow();
    expect(server.mutations).toEqual([]);
    expect(server.calls("write_flex_crew_mapping")).toEqual([]);
    expect(server.current).toEqual([mapped()]);
    expect(server.state).toBe("busy");
  });

  it.each(["malformed JSON", "transport", "HTTP 500"])("a %s GET never becomes a destructive empty list", async (kind) => {
    const server = new Server();
    server.current = [mapped()];
    server.providerHook = () => {
      if (kind === "transport") throw new Error("network");
      return new Response(kind === "malformed JSON" ? "{" : "error", { status: kind === "HTTP 500" ? 500 : 200 });
    };
    await expect(server.run()).rejects.toThrow();
    expect(server.mutations).toEqual([]);
    expect(server.current).toEqual([mapped()]);
    expect(server.state).toBe("busy");
  });

  it("a read RPC failure releases settled ownership without a success token", async () => {
    const server = new Server();
    server.beforeRpc = (call) => call.name === "read_flex_crew_reconciliation" ? refusal("55000", "projection unavailable") : undefined;
    await expect(server.run()).rejects.toThrow("projection unavailable");
    expect(server.calls("release_flex_crew_reconciliation")[0].args.p_state_token).toBeNull();
    expect(server.mutations).toEqual([]);
  });
});
