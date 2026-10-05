import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { businessRoleLookupFor, inferTierFromRoleCode } from "./flexBusinessRoles.ts";

type Department = "sound" | "lights";
interface Mapping {
  crew_call_id: string;
  technician_id: string;
  resource_id: string | null;
  line_item_id: string | null;
}
interface Desired extends Omit<Mapping, "line_item_id"> {
  department: Department;
  role: string;
}
interface Projection { state_token: string; desired: Desired[]; current: Mapping[]; owned: Mapping[] }
interface Contact { id: string; resourceId: string }
interface Gate { element: string; owner: string; outstanding: boolean }
export interface FlexCrewReconciliationResult {
  added: number;
  removed: number;
  kept: number;
  rolesSet: number;
  diagnostics: string[];
}

const API = "https://sectorpro.flexrentalsolutions.com/f5/api/line-item";
const REQUEST_MS = 15_000;
const RUN_MS = 90_000;
const MAX_PASSES = 8;
const SQL_REFUSALS = new Set(["P0001", "P0002", "P0409", "55P03", "40001", "42501", "22023", "55000", "23503", "23505"]);
const TERMINAL_REFUSALS = new Set([400, 401, 403, 404, 405, 409, 413, 415, 422, 429]);

class RpcFailure extends Error {
  constructor(readonly definitive: boolean, readonly code: string, message: string) {
    super(message);
  }
}

/** Require an object-shaped RPC or provider record. */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed Flex reconciliation data");
  return value as Record<string, unknown>;
}
/** Require a nonempty identity without coercing provider values. */
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Missing Flex reconciliation identity");
  return value;
}
/** Preserve explicit missing identities while rejecting malformed values. */
function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}
/** Validate current intent, mapping identities and the durable contact journal. */
function projection(value: unknown): Projection {
  const row = record(value);
  if (!Array.isArray(row.desired) || !Array.isArray(row.current)) throw new Error("Malformed crew projection");
  if (!Array.isArray(row.owned_contacts)) throw new Error("Missing durable contact journal");
  /** Validate the shared crew-call, technician and resource identity fields. */
  const base = (v: unknown) => {
    const r = record(v);
    return { crew_call_id: string(r.crew_call_id), technician_id: string(r.technician_id), resource_id: nullableString(r.resource_id) };
  };
  return {
    state_token: string(row.state_token),
    desired: row.desired.map((v) => {
      const r = record(v);
      if (r.department !== "sound" && r.department !== "lights") throw new Error("Unsupported crew department");
      return { ...base(v), department: r.department, role: string(r.role) };
    }),
    current: row.current.map((v) => ({ ...base(v), line_item_id: nullableString(record(v).line_item_id) })),
    owned: row.owned_contacts.map((v) => ({ ...base(v), line_item_id: string(record(v).line_item_id) })),
  };
}

// Abort is advisory. The race also bounds providers that ignore it; the durable
// operation stays outstanding even when that provider completes much later.
/** Bound I/O independently of advisory abort support; timeout never proves settlement. */
async function bounded<T>(task: (signal: AbortSignal) => PromiseLike<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Flex reconciliation request timed out; completion may be unknown"));
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => task(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Current database state is the sole intent. No historical action is accepted.
 * Busy ownership never expires here. Operator recovery must prove retirement
 * and settle the external operation before another worker can be admitted.
 */
export async function reconcileFlexCrew(
  supabase: SupabaseClient,
  jobId: string,
  department: Department,
  flexToken: string,
  options: { fetch?: typeof fetch } = {},
): Promise<FlexCrewReconciliationResult> {
  string(jobId);
  string(flexToken);
  if (department !== "sound" && department !== "lights") throw new Error("Unsupported crew department");
  const fetchImpl = options.fetch ?? fetch;
  const deadline = Date.now() + RUN_MS;
  const result: FlexCrewReconciliationResult = { added: 0, removed: 0, kept: 0, rolesSet: 0, diagnostics: [] };
  const diagnostics = new Set<string>();
  const addedResources = new Set<string>();
  const appliedRoles = new Map<string, string>();
  const ownedContacts = new Map<string, { contact: Contact; row: Pick<Mapping, "crew_call_id" | "technician_id"> }>();
  let gate: Gate | undefined;
  const headers = {
    "X-Auth-Token": flexToken, "X-Requested-With": "XMLHttpRequest",
    "X-API-Client": "flex5-desktop", Accept: "*/*",
  };
  /** Keep every normal request within both request and reconciliation deadlines. */
  const remaining = () => {
    const ms = Math.min(REQUEST_MS, deadline - Date.now());
    if (ms <= 0) throw new Error("Flex reconciliation time budget exhausted");
    return ms;
  };
  /** Call a bounded service RPC and distinguish definitive SQL refusals from ambiguous failures. */
  async function rpc(name: string, args: Record<string, unknown>, cleanup = false): Promise<unknown> {
    const response = await bounded((signal) => supabase.rpc(name, args).abortSignal(signal), cleanup ? REQUEST_MS : remaining());
    if (response.error) {
      const code = response.error.code ?? "";
      throw new RpcFailure(SQL_REFUSALS.has(code), code, `${name}: ${response.error.message}`);
    }
    return response.data;
  }
  /** Bind every ownership-sensitive RPC to the claimed physical element and token. */
  const ownerArgs = () => ({ p_element: gate!.element, p_owner: gate!.owner });
  /** Construct the provider route for the claimed physical crew element. */
  const elementUrl = () => `${API}/${encodeURIComponent(gate!.element)}`;
  /** Load current intent and journal only for the active, settled owner. */
  async function read(): Promise<Projection> {
    return projection(await rpc("read_flex_crew_reconciliation", ownerArgs()));
  }
  /** Require an authoritative provider row read with unique contact and resource identities. */
  async function contacts(): Promise<{ contacts: Contact[]; rows: Map<string, Record<string, unknown>> }> {
    const qs = new URLSearchParams({ _dc: String(Date.now()), node: "root" });
    qs.append("codeList", "contact");
    qs.append("codeList", "business-role");
    const data = await bounded(async (signal) => {
      const res = await fetchImpl(`${elementUrl()}/row-data/?${qs}`, { headers, signal, redirect: "error" });
      if (!res.ok) throw new Error(`Flex contact read failed: HTTP ${res.status}`);
      return await res.json() as unknown;
    }, remaining());
    if (!Array.isArray(data)) throw new Error("Flex contact read must be an array");
    const rows = new Map<string, Record<string, unknown>>();
    const found: Contact[] = [];
    for (const value of data) {
      const row = record(value);
      const id = string(row.id);
      if (rows.has(id)) throw new Error("Duplicate Flex line identity");
      rows.set(id, row);
      const types = [row.managedResourceLineItemType, row.type].filter((value) => value != null && value !== "");
      if (types.some((value) => typeof value !== "string")) throw new Error(`Malformed Flex contact type for line ${id}`);
      const normalizedTypes = (types as string[]).map((value) => value.toLowerCase());
      if (new Set(normalizedTypes).size > 1) throw new Error(`Conflicting Flex contact types for line ${id}`);
      const type = normalizedTypes[0];
      if (type !== "contact") {
        // Unclassified rows are not proof of absence for an add either.
        if (!type) throw new Error(`Unproven Flex contact type for line ${id}`);
        continue;
      }
      const resource = row.resource == null ? {} : record(row.resource);
      const identities = [row.resourceId, resource.id, resource.resourceId].filter((value) => value != null && value !== "").map(string);
      if (new Set(identities).size !== 1) throw new Error(`Missing or conflicting Flex resource identity for line ${id}`);
      found.push({ id, resourceId: identities[0] });
    }
    return { contacts: found, rows };
  }
  /** Persist a verified mapping through the ownership and physical-retarget boundary. */
  async function map(row: Pick<Mapping, "crew_call_id" | "technician_id">, line: string | null) {
    await rpc("write_flex_crew_mapping", {
      ...ownerArgs(), p_crew_call: row.crew_call_id, p_technician: row.technician_id, p_line_item: line,
    });
  }
  /** Retain durable ownership when external completion cannot be established. */
  async function quarantine() {
    // Failure to record uncertainty still leaves a busy, outstanding gate.
    try { await rpc("settle_flex_crew_operation", { ...ownerArgs(), p_uncertain: true }, true); }
    catch { /* Never release or retry the external mutation. */ }
  }
  /** Durably admit one external write, consume its response and settle only with proven ownership. */
  async function mutate(
    kind: "add" | "remove" | "role", row: Pick<Mapping, "crew_call_id" | "technician_id">,
    token: string, url: string, init: RequestInit, verify?: () => Promise<string>,
  ) {
    remaining();
    // Set this BEFORE admission: a lost RPC response can mean it committed.
    gate!.outstanding = true;
    try {
      await rpc("admit_flex_crew_operation", {
        ...ownerArgs(), p_state_token: token,
        // Retain the exact target/payload for recovery even if local mappings
        // disappear. Credentials are deliberately absent from the descriptor.
        p_operation: { kind, url, method: init.method, body: init.body ?? null, crew_call_id: row.crew_call_id, technician_id: row.technician_id },
      });
    } catch (error) {
      if (error instanceof RpcFailure && error.definitive) gate!.outstanding = false;
      throw error;
    }
    try {
      const status = await bounded(async (signal) => {
        const res = await fetchImpl(url, { ...init, headers: { ...headers, ...init.headers }, signal, redirect: "error" });
        await res.text(); // Includes refused requests: settle only after full body consumption.
        return res.status;
      }, remaining());
      if (TERMINAL_REFUSALS.has(status)) {
        await rpc("settle_flex_crew_operation", { ...ownerArgs(), p_uncertain: false });
        gate!.outstanding = false;
        throw new Error(`Flex ${kind} refused: HTTP ${status}`);
      }
      if (status < 200 || status >= 300 || status === 202) throw new Error(`Flex ${kind} outcome uncertain: HTTP ${status}`);
      if (kind === "add") {
        const line = await verify?.();
        if (!line) throw new Error("Added contact has no verified identity");
        await rpc("settle_flex_crew_add", {
          ...ownerArgs(), p_crew_call: row.crew_call_id, p_technician: row.technician_id, p_line_item: line,
        });
      } else {
        await rpc("settle_flex_crew_operation", { ...ownerArgs(), p_uncertain: false });
      }
      gate!.outstanding = false;
    } catch (error) {
      if (gate!.outstanding) await quarantine();
      throw error;
    }
  }

  /** Reconcile one current projection while retaining unproven contacts and journaled ownership. */
  async function reconcile(snapshot: Projection) {
    // SQL supplies the union of all aliases and filters explicit roles,
    // dryhire and deleted tour membership. Never infer intent from profiles.
    if (!snapshot.current.length && !snapshot.owned.length && !ownedContacts.size && snapshot.desired.every(row => !row.resource_id)) {
      for (const row of snapshot.desired) {
        diagnostics.add(`Technician ${row.technician_id}: no Flex resource or verified mapped contact; skipped`);
      }
      result.kept = 0;
      return;
    }
    const remote = await contacts();
    const byLine = new Map(remote.contacts.map((row) => [row.id, row]));
    const byResource = new Map<string, Contact>();
    for (const row of remote.contacts) {
      if (byResource.has(row.resourceId)) throw new Error(`Duplicate Flex contacts for resource ${row.resourceId}`);
      byResource.set(row.resourceId, row);
    }
    const knownLines = new Set<string>();
    const currentLines = new Map<Mapping, Contact | undefined>();
    for (const row of snapshot.owned) {
      const contact = row.line_item_id ? byLine.get(row.line_item_id) : undefined;
      if (!contact && row.line_item_id && remote.rows.has(row.line_item_id)) throw new Error(`Journaled line ${row.line_item_id} is not a proven contact`);
      if (contact) ownedContacts.set(contact.id, { contact, row });
    }
    // Validate every mapping before deleting anything, including null-resource
    // stale rows. A stored line ID proves scope, GET proves external identity.
    for (const row of snapshot.current) {
      let contact: Contact | undefined;
      if (row.line_item_id) {
        contact = byLine.get(row.line_item_id);
        if (!contact && remote.rows.has(row.line_item_id)) throw new Error(`Mapped line ${row.line_item_id} is not a proven contact`);
      } else {
        if (!row.resource_id && !snapshot.desired.some((d) => d.crew_call_id === row.crew_call_id && d.technician_id === row.technician_id)) {
          throw new Error(`Missing identity for mapped technician ${row.technician_id}`);
        }
        contact = row.resource_id ? byResource.get(row.resource_id) : undefined;
      }
      currentLines.set(row, contact);
      if (contact) {
        knownLines.add(contact.id);
        ownedContacts.set(contact.id, { contact, row });
      }
    }
    const desired = new Map<string, Desired[]>();
    for (const row of snapshot.desired) {
      const mapped = [...snapshot.current, ...snapshot.owned].find((c) => c.crew_call_id === row.crew_call_id && c.technician_id === row.technician_id);
      const resource = row.resource_id ?? (mapped ? currentLines.get(mapped)?.resourceId
        ?? (mapped.line_item_id ? byLine.get(mapped.line_item_id)?.resourceId : undefined) : undefined);
      if (!resource) {
        diagnostics.add(`Technician ${row.technician_id}: no Flex resource or verified mapped contact; skipped`);
        continue;
      }
      const aliases = desired.get(resource) ?? [];
      if (aliases.some((other) => other.role !== row.role || other.department !== row.department)) {
        throw new Error(`Conflicting desired roles for Flex resource ${resource}`);
      }
      aliases.push(row);
      desired.set(resource, aliases);
    }
    for (const contact of remote.contacts) {
      if (!knownLines.has(contact.id) && !ownedContacts.has(contact.id) && !desired.has(contact.resourceId)) {
        diagnostics.add(`Unmapped Flex contact ${contact.id} retained; ownership is unproven`);
      }
    }
    const removedLines = new Set<string>();
    // Source deletion can cascade local mappings between passes. Preserve this
    // worker's verified ownership until the contact is reconciled and settled.
    for (const [line, owned] of ownedContacts) {
      const contact = byLine.get(line);
      if (!contact) { ownedContacts.delete(line); continue; }
      if (!desired.has(contact.resourceId)) {
        await mutate("remove", owned.row, snapshot.state_token, `${API}/${encodeURIComponent(line)}`, { method: "DELETE" });
        result.removed++;
        removedLines.add(line);
        byResource.delete(contact.resourceId);
        appliedRoles.delete(line);
        ownedContacts.delete(line);
      }
    }
    for (const row of snapshot.current) {
      const contact = currentLines.get(row);
      if (contact && !desired.has(contact.resourceId) && !removedLines.has(contact.id)) {
        await mutate("remove", row, snapshot.state_token, `${API}/${encodeURIComponent(contact.id)}`, { method: "DELETE" });
        result.removed++;
        removedLines.add(contact.id);
        byResource.delete(contact.resourceId);
        appliedRoles.delete(contact.id);
      }
      const stillDesired = snapshot.desired.some((d) => d.crew_call_id === row.crew_call_id && d.technician_id === row.technician_id);
      if (!contact || removedLines.has(contact.id) || !stillDesired) await map(row, null);
    }
    for (const [resource, aliases] of desired) {
      let contact = byResource.get(resource);
      if (!contact) {
        const params = new URLSearchParams({ resourceParentId: "", managedResourceLineItemType: "contact", quantity: "1", parentLineItemId: "", nextSiblingId: "" });
        await mutate("add", aliases[0], snapshot.state_token,
          `${elementUrl()}/add-resource/${encodeURIComponent(resource)}`,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: params.toString() },
          async () => {
            const matches = (await contacts()).contacts.filter((row) => row.resourceId === resource);
            if (matches.length !== 1) throw new Error(`Added resource ${resource} has no unique verified Flex line`);
            contact = matches[0];
            ownedContacts.set(contact.id, { contact, row: aliases[0] });
            return contact.id;
          });
        result.added++;
        addedResources.add(resource);
      }
      if (!contact) throw new Error("Missing verified Flex contact after add");
      for (const alias of aliases) {
        const current = snapshot.current.find((row) => row.crew_call_id === alias.crew_call_id && row.technician_id === alias.technician_id);
        if (current?.line_item_id !== contact.id) await map(alias, contact.id);
      }
      const lookup = businessRoleLookupFor(aliases[0].department, inferTierFromRoleCode(aliases[0].role));
      if (!lookup.supported) {
        diagnostics.add(`Resource ${resource}: ${lookup.diagnostic}`);
      } else if (appliedRoles.get(contact.id) !== lookup.roleId) {
        await mutate("role", aliases[0], snapshot.state_token, `${elementUrl()}/row-data/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineItemId: contact.id, fieldType: "business-role", payloadValue: lookup.roleId }),
        });
        appliedRoles.set(contact.id, lookup.roleId);
        result.rolesSet++;
      }
    }
    result.kept = [...desired.keys()].filter((resource) => !addedResources.has(resource)).length;
  }

  try {
    const claim = record(await rpc("claim_flex_crew_reconciliation", { p_job_id: jobId, p_department: department }));
    // A malformed/lost claim never gets a guessed release or another claim.
    gate = { element: string(claim.flex_element_id), owner: string(claim.owner_token), outstanding: false };
    let snapshot = await read();
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      try {
        await reconcile(snapshot);
      } catch (error) {
        // Only an explicit SQL state-change refusal proves admission failed.
        // Transport/gateway ambiguity must not be retried.
        if (!(error instanceof RpcFailure && error.code === "P0409" && error.definitive && !gate.outstanding)) throw error;
        snapshot = await read();
        continue;
      }
      const fresh = await read();
      if (fresh.state_token === snapshot.state_token) {
        try {
          await rpc("release_flex_crew_reconciliation", { ...ownerArgs(), p_state_token: fresh.state_token });
        } catch (error) {
          if (!(error instanceof RpcFailure && error.code === "P0409" && error.definitive)) throw error;
          snapshot = await read();
          continue;
        }
        gate = undefined;
        result.diagnostics = [...diagnostics];
        return result;
      }
      snapshot = fresh;
    }
    throw new Error("Flex reconciliation pass budget exhausted");
  } catch (error) {
    // Settled writes still own contacts. A source cascade plus failed read can
    // erase mappings; SQL retains the contact journal until verified success.
    if (gate && !gate.outstanding && ownedContacts.size) {
      throw new Error(`${error instanceof Error ? error.message : 'Flex reconciliation failed'}; durable contact ownership retained for operator recovery`, { cause: error });
    }
    // No finally release: local certainty is required. Release without a token
    // is only an error exit for known settled work, never a success shortcut.
    if (gate && !gate.outstanding) {
      try { await rpc("release_flex_crew_reconciliation", { ...ownerArgs(), p_state_token: null }, true); }
      catch { throw new Error("Flex reconciliation failed and release was not confirmed; inspect the durable gate", { cause: error }); }
    }
    if (gate?.outstanding) throw new Error("Flex reconciliation outcome is unverified; durable ownership retained for operator recovery", { cause: error });
    throw error;
  }
}
