import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLEX_FOLDER_IDS as definitions, FLEX_CUSTOM_FIELD_IDS } from '../../../src/utils/flex-folders/constants';
import { assertNotCrewMutation } from './flexCrewProxyGuard.ts';

type Row = Record<string, unknown>;
const id = 'fc510000-0000-0000-0000-000000000001';
const resource = 'fc510000-0000-0000-0000-000000000002';
const line = 'fc510000-0000-0000-0000-000000000003';
const parent = 'fc510000-0000-0000-0000-000000000004';
const other = 'fc510000-0000-0000-0000-000000000005';
const BASE = 'https://flex.test/f5/api';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const meta = (element = id, definition = definitions.pullSheet, parentId?: string): Row => ({
  elementId: { data: element }, elementDefinitionId: { data: definition }, ...(parentId ? { parentElementId: { data: parentId } } : {}),
});
const item = (identity = line, type = 'inventory-model', documentId = id): Row => ({ id: identity, managedResourceLineItemType: type, documentId });
const form = (overrides: Row = {}): string => new URLSearchParams({
  resourceParentId: '', managedResourceLineItemType: 'inventory-model', quantity: '2', parentLineItemId: '', nextSiblingId: '',
  ...overrides,
} as Record<string, string>).toString();
const addPath = (family = 'line-item', document = id) => `/${family}/${document}/add-resource/${resource}`;

class Server {
  tables: Record<string, Row[]> = { flex_crew_calls: [], flex_crew_reconciliation_gates: [], flex_folders: [], flex_work_orders: [] };
  metadata = new Map<string, unknown>([[id, meta()], [parent, meta(parent, definitions.subFolder)], [other, meta(other, definitions.subFolder)]]);
  rows: unknown = [item()];
  tree: unknown = [{ elementId: id, definitionId: definitions.pullSheet, leaf: true }];
  providerCalls: { url: URL; init: RequestInit }[] = [];
  queries: URL[] = [];
  failTable?: string;
  providerHook?: (url: URL, init: RequestInit) => Promise<Response | undefined> | Response | undefined;
  client = createClient('https://sql.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      this.queries.push(url);
      const table = url.pathname.split('/').pop()!;
      if (table === this.failTable) return json({ code: '42501', message: 'denied' }, 403);
      const filter = url.searchParams.get(table.includes('crew') ? 'flex_element_id' : 'element_id')?.slice(3);
      const target = url.searchParams.get('or')?.match(/\.eq\.([0-9a-f-]+)/)?.[1];
      const rows = this.tables[table];
      if (!rows) throw new Error(`Unexpected table ${table}`);
      return json(rows.filter((r) => table === 'flex_work_orders' ? r.flex_document_id === target || r.flex_element_id === target
        : r[table.includes('crew') ? 'flex_element_id' : 'element_id'] === filter));
    } },
  });
  credentialed: typeof fetch = async (input, init = {}) => {
    // Same shape as the adapter: only bounded, credentialed GETs are available.
    const headers = new Headers({ 'X-Auth-Token': 'private-test-token', apikey: 'private-test-token' });
    const options = { ...init, headers };
    const url = new URL(String(input));
    this.providerCalls.push({ url, init: options });
    expect(url.origin).toBe('https://flex.test');
    expect(options.method).toBe('GET');
    expect(options.redirect).toBe('error');
    expect(options.signal).toBeDefined();
    const hooked = await this.providerHook?.(url, options);
    if (hooked) return hooked;
    if (url.pathname.endsWith('/key-info/')) {
      const element = url.pathname.split('/')[4];
      return this.metadata.has(element) ? json(this.metadata.get(element)) : json({ error: 'absent' }, 404);
    }
    if (url.pathname.endsWith('/row-data/')) return json(this.rows);
    if (url.pathname.endsWith('/tree')) return json(this.tree);
    throw new Error('Unexpected trusted GET');
  };
  run(path: string, body?: string, type = 'application/x-www-form-urlencoded; charset=UTF-8', method = 'POST') {
    return assertNotCrewMutation(this.client, new URL(`${BASE}${path}`), method, { apiBaseUrl: BASE, body, contentType: type, fetch: this.credentialed });
  }
  financial(definition = definitions.ordenTrabajo) { this.metadata.set(id, meta(id, definition, parent)); }
}
afterEach(() => vi.useRealTimers());

describe('trusted definition and equipment compatibility', () => {
  it('allows a genuine pullsheet equipment add with the existing form payload', async () => {
    const server = new Server();
    await server.run(addPath(), form());
    expect(server.providerCalls).toHaveLength(1);
    expect(server.providerCalls[0].url.pathname).toBe(`/f5/api/element/${id}/key-info/`);
  });

  it('allows grouped equipment with a verified parent and next sibling in the same pullsheet', async () => {
    const server = new Server();
    server.rows = [item(line), item(other)];
    await server.run(addPath(), form({ parentLineItemId: line, nextSiblingId: other }));
    expect(server.providerCalls.map((r) => r.url.pathname)).toEqual([`/f5/api/element/${id}/key-info/`, `/f5/api/line-item/${id}/row-data/`]);
  });

  it('allows nested authoritative rows', async () => {
    const server = new Server();
    server.rows = [{ ...item(other), children: [item(line)] }];
    await server.run(addPath(), form({ parentLineItemId: line }));
  });

  it.each([definitions.presupuesto, definitions.presupuestoDryHire])('preserves equipment adds to proven financial definition %s with matching query and body', async (definition) => {
    const server = new Server();
    server.financial(definition);
    const query = new URLSearchParams({ resourceParentId: '', managedResourceLineItemType: 'inventory-model', quantity: '2' });
    await server.run(`${addPath('financial-document-line-item')}?${query}`, form());
  });

  it('allows a new work order before any DB insert, using wrapped provider identity and definition', async () => {
    const server = new Server();
    server.financial();
    const query = new URLSearchParams({ resourceParentId: parent, managedResourceLineItemType: 'service-offering', quantity: '1' });
    await server.run(`${addPath('financial-document-line-item')}?${query}`);
    expect(server.tables.flex_work_orders).toEqual([]);
    expect(server.providerCalls).toHaveLength(2);
  });

  it('allows a new work order with only a wrapped definition from the exact credentialed key-info route', async () => {
    const server = new Server();
    server.metadata.set(id, { definitionId: { data: definitions.ordenTrabajo } });
    await server.run(`/financial-document-line-item/${id}/add-note`, JSON.stringify({ note: 'Dietas' }), 'application/json');
    expect(server.tables.flex_work_orders).toEqual([]);
    expect(server.providerCalls[0].url.toString()).toBe(`${BASE}/element/${id}/key-info/`);
    expect(new Headers(server.providerCalls[0].init.headers).has('X-Auth-Token')).toBe(true);
    expect(server.providerCalls[0].init.redirect).toBe('error');
  });

  it('preserves actual new-work-order adds when key-info omits ID and parent, using trusted tree parent evidence', async () => {
    const server = new Server();
    server.metadata.set(id, { elementDefinitionId: { data: definitions.ordenTrabajo } });
    server.tree = [{ elementId: parent, children: [{ elementId: id, definitionId: definitions.ordenTrabajo }] }];
    const query = new URLSearchParams({ resourceParentId: parent, managedResourceLineItemType: 'service-offering', quantity: '1' });
    await server.run(`${addPath('financial-document-line-item')}?${query}`);
    expect(server.providerCalls.at(-1)?.url.toString()).toBe(`${BASE}/element/${parent}/tree`);
  });

  it('the parent-tree fallback rejects a caller-selected parent when the target is not a direct child', async () => {
    const server = new Server();
    server.metadata.set(id, { elementDefinitionId: { data: definitions.ordenTrabajo } });
    server.tree = [{ elementId: parent, children: [{ elementId: other, children: [{ elementId: id }] }] }];
    await expect(server.run(addPath('financial-document-line-item'), form({ resourceParentId: parent, managedResourceLineItemType: 'service-offering' }))).rejects.toMatchObject({ status: 409 });
  });

  it('allows a grouped service-offering work-order line with the actual query/form combination', async () => {
    const server = new Server();
    server.financial();
    server.rows = [item(line, 'service-offering')];
    const fields = { resourceParentId: parent, managedResourceLineItemType: 'service-offering', quantity: '1' };
    await server.run(`${addPath('financial-document-line-item')}?${new URLSearchParams(fields)}`, form({ ...fields, parentLineItemId: line }));
  });

  it('allows an existing tracked work order when metadata omits identity but remains consistent', async () => {
    const server = new Server();
    server.tables.flex_work_orders = [{ flex_document_id: id, flex_element_id: id, folder_element_id: parent }];
    server.metadata.set(id, { elementDefinitionId: { data: definitions.ordenTrabajo } });
    await server.run(`/financial-document-line-item/${id}/add-note`, JSON.stringify({ note: 'Dietas' }), 'application/json');
  });

  it('uses a proven local folder when key-info lacks definition fields, without inventing a type', async () => {
    const server = new Server();
    server.tables.flex_folders = [{ element_id: id, folder_type: 'pull_sheet' }];
    server.metadata.set(id, { id });
    await server.run(addPath(), form());
  });

  it('supports raw metadata fields as well as wrapped fields', async () => {
    const server = new Server();
    server.metadata.set(id, { id, definitionId: definitions.pullSheet });
    await server.run(addPath(), form());
  });

  it('keeps read-only calls available without mutation classification', async () => {
    const server = new Server();
    await server.run(`/line-item/${id}/row-data`, undefined, '', 'GET');
    expect(server.queries).toEqual([]);
    expect(server.providerCalls).toEqual([]);
  });
});

describe('crew, unknown and conflicting targets always fail closed', () => {
  it.each(['flex_crew_calls', 'flex_crew_reconciliation_gates'])('denies %s roots even when provider metadata claims inventory', async (table) => {
    const server = new Server();
    server.tables[table] = [{ flex_element_id: id }];
    await expect(server.run(addPath(), form())).rejects.toMatchObject({ status: 409 });
    expect(server.providerCalls).toEqual([]);
  });

  it('denies crew definitions absent from all local mappings', async () => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.crewCall));
    await expect(server.run(`/financial-document-line-item/${id}/add-note`, 'note=x')).rejects.toMatchObject({ status: 409 });
  });

  it.each(['contact', 'business-role', 'unknown'])('rejects pullsheet add type %s', async (type) => {
    await expect(new Server().run(addPath(), form({ managedResourceLineItemType: type }))).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    { elementId: id, definitionId: other },
    { elementId: other, definitionId: definitions.pullSheet },
    { elementId: id },
    { id, elementId: other, definitionId: definitions.pullSheet },
    { id, definitionId: definitions.pullSheet, elementDefinitionId: definitions.crewCall },
  ])('rejects unknown, missing or conflicting metadata %j', async (metadata) => {
    const server = new Server();
    server.metadata.set(id, metadata);
    await expect(server.run(addPath(), form())).rejects.toMatchObject({ status: 409 });
  });

  it('does not let local tracking override a provider crew classification', async () => {
    const server = new Server();
    server.tables.flex_folders = [{ element_id: id, folder_type: 'pull_sheet' }];
    server.metadata.set(id, meta(id, definitions.crewCall));
    await expect(server.run(addPath(), form())).rejects.toMatchObject({ status: 409 });
  });

  it('rejects contradictory local records rather than choosing the favorable classification', async () => {
    const server = new Server();
    server.tables.flex_folders = [{ element_id: id, folder_type: 'pull_sheet' }];
    server.tables.flex_work_orders = [{ flex_document_id: id, flex_element_id: id, folder_element_id: parent }];
    await expect(server.run(addPath(), form())).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a work-order response with the wrong returned identity even if its definition is valid', async () => {
    const server = new Server();
    server.metadata.set(id, { elementId: { data: other }, definitionId: { data: definitions.ordenTrabajo } });
    await expect(server.run(`/financial-document-line-item/${id}/add-note`, 'note=x')).rejects.toMatchObject({ status: 409 });
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects financial collections and unclassified paths for %s', async (method) => {
    const server = new Server();
    for (const path of ['/financial-document-line-item', `/financial-document-line-item/${id}`, '/line-item', `/line-item/${line}/delete`, '/element/delete', `/element/${id}/unknown`]) {
      await expect(server.run(path, undefined, '', method)).rejects.toMatchObject({ status: expect.toBeOneOf([400, 409]) });
    }
    expect(server.providerCalls).toEqual([]);
  });

  it('unknown financial UUIDs cannot exploit add or bulk-update', async () => {
    const server = new Server();
    server.metadata.set(id, { elementId: id, definitionId: other });
    await expect(server.run(addPath('financial-document-line-item'), form())).rejects.toMatchObject({ status: 409 });
    await expect(server.run(`/financial-document-line-item/${id}/bulk-update`, JSON.stringify({ bulkData: [{ itemId: line, quantity: 2 }] }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it.each(['flex_crew_calls', 'flex_crew_reconciliation_gates', 'flex_folders', 'flex_work_orders'])('lookup failure in %s never becomes permission', async (table) => {
    const server = new Server();
    server.failTable = table;
    await expect(server.run(addPath(), form())).rejects.toMatchObject({ status: 503 });
  });

  it.each(['HTTP failure', 'transport', 'malformed JSON'])('provider %s does not allow a mutation', async (kind) => {
    const server = new Server();
    server.providerHook = () => {
      if (kind === 'transport') throw new Error('private-test-token must not escape');
      return new Response(kind === 'malformed JSON' ? '{' : 'error', { status: kind === 'HTTP failure' ? 500 : 200 });
    };
    const error = await server.run(addPath(), form()).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 503 });
    expect(String(error)).not.toContain('private-test-token');
  });

  it('bounds a stalled metadata body', async () => {
    vi.useFakeTimers();
    const server = new Server();
    server.providerHook = () => new Response(new ReadableStream({ start() {} }));
    const running = expect(server.run(addPath(), form())).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(10_001);
    await running;
  });
});

describe('referenced line and parent ownership', () => {
  it('rejects a parent or sibling outside the authoritative document rows', async () => {
    for (const field of ['parentLineItemId', 'nextSiblingId']) {
      await expect(new Server().run(addPath(), form({ [field]: other }))).rejects.toMatchObject({ status: 409 });
    }
  });

  it.each(['contact', 'unclassified'])('does not use a %s child as a grouping parent', async (type) => {
    const server = new Server();
    server.rows = [type === 'contact' ? item(line, type) : { id: line }];
    await expect(server.run(addPath(), form({ parentLineItemId: line }))).rejects.toMatchObject({ status: 409 });
  });

  it('denies a crew tombstone returned as a child of a safe document', async () => {
    const server = new Server();
    server.tables.flex_crew_reconciliation_gates = [{ flex_element_id: line }];
    await expect(server.run(addPath(), form({ parentLineItemId: line }))).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a row that claims another document even when its ID matches', async () => {
    const server = new Server();
    server.rows = [item(line, 'inventory-model', other)];
    await expect(server.run(addPath(), form({ parentLineItemId: line }))).rejects.toMatchObject({ status: 409 });
  });

  it('rejects an unrelated resourceParentId for financial adds', async () => {
    const server = new Server();
    server.financial();
    await expect(server.run(addPath('financial-document-line-item'), form({ resourceParentId: other }))).rejects.toMatchObject({ status: 409 });
  });

  it.each([null, {}, { items: [item()] }, [{ id: line }, { id: line }]])('rejects malformed authoritative row data %j', async (rows) => {
    const server = new Server();
    server.rows = rows;
    await expect(server.run(addPath(), form({ parentLineItemId: line }))).rejects.toMatchObject({ status: expect.toBeOneOf([400, 409]) });
  });
});

describe('audited financial update payloads', () => {
  it.each(['quantity', 'timeQty', 'time-qty', 'pricingModel', 'pricing-model'])('allows %s only on a proven financial member', async (field) => {
    const server = new Server();
    server.financial();
    server.rows = [item(line, 'service-offering')];
    for (const endpoint of ['update', 'row-data']) {
      await server.run(`/financial-document-line-item/${id}/${endpoint}`, JSON.stringify({ lineItemId: line, fieldType: field, payloadValue: field.startsWith('pricing') ? resource : '2' }), 'application/json');
    }
  });

  it('allows the actual work-order date/time/quantity bulkData fields', async () => {
    const server = new Server();
    server.financial();
    server.rows = [item(line, 'service-offering')];
    await server.run(`/financial-document-line-item/${id}/bulk-update`, JSON.stringify({ bulkData: [{ itemId: line, alternatePickupDate: '2026-10-04', alternateReturnDate: '2026-10-05', timeQty: 1, quantity: 2 }] }), 'application/json');
  });

  it.each(['contact', 'business-role', 'resourceId', 'managedResourceLineItemType'])('rejects contact or unaudited field %s', async (field) => {
    const server = new Server();
    server.financial();
    await expect(server.run(`/financial-document-line-item/${id}/update`, JSON.stringify({ lineItemId: line, fieldType: field, payloadValue: resource }), 'application/json')).rejects.toMatchObject({ status: 409 });
    await expect(server.run(`/financial-document-line-item/${id}/bulk-update`, JSON.stringify({ bulkData: [{ itemId: line, [field]: resource }] }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('rejects cross-document updates and bulk item IDs', async () => {
    const server = new Server();
    server.financial();
    await expect(server.run(`/financial-document-line-item/${id}/update`, JSON.stringify({ lineItemId: other, fieldType: 'quantity', payloadValue: 2 }), 'application/json')).rejects.toMatchObject({ status: 409 });
    await expect(server.run(`/financial-document-line-item/${id}/bulk-update`, JSON.stringify({ bulkData: [{ itemId: other, timeQty: 2 }] }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('rejects financial field updates on a contact child', async () => {
    const server = new Server();
    server.financial();
    server.rows = [item(line, 'contact')];
    await expect(server.run(`/financial-document-line-item/${id}/update`, JSON.stringify({ lineItemId: line, fieldType: 'quantity', payloadValue: 2 }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('preserves both JSON and form add-note callers', async () => {
    const server = new Server();
    server.financial();
    await server.run(`/financial-document-line-item/${id}/add-note`, JSON.stringify({ note: 'Dietas y desplazamiento' }), 'application/json');
    await server.run(`/financial-document-line-item/${id}/add-note`, 'note=Dietas');
  });
});

describe('payload ambiguity and element operations', () => {
  it.each([
    ['duplicate query', `${addPath()}?managedResourceLineItemType=inventory-model&managedResourceLineItemType=contact`, form(), 'application/x-www-form-urlencoded'],
    ['duplicate form', addPath(), `${form()}&quantity=2`, 'application/x-www-form-urlencoded'],
    ['conflicting query/body', `${addPath()}?managedResourceLineItemType=contact`, form(), 'application/x-www-form-urlencoded'],
    ['duplicate JSON', addPath(), '{"managedResourceLineItemType":"inventory-model","managedResourceLineItemType":"contact","quantity":2}', 'application/json'],
    ['escaped duplicate JSON', addPath(), '{"quantity":2,"quanti\\u0074y":2,"managedResourceLineItemType":"inventory-model"}', 'application/json'],
    ['unknown content type', addPath(), form(), 'text/plain'],
  ])('rejects %s before any trusted network call', async (_label, path, body, type) => {
    const server = new Server();
    await expect(server.run(path, body, type)).rejects.toMatchObject({ status: 400 });
    expect(server.providerCalls).toEqual([]);
  });

  it('rejects nested bulk duplicate JSON fields', async () => {
    const server = new Server();
    server.financial();
    await expect(server.run(`/financial-document-line-item/${id}/bulk-update`, `{"bulkData":[{"itemId":"${line}","quantity":1,"quantity":2}]}`, 'application/json')).rejects.toMatchObject({ status: 400 });
  });

  it.each([definitions.subFolder, definitions.ordenTrabajo, definitions.pullSheet, definitions.documentacionTecnica, definitions.hojaGastos])('allows existing safe creation definition %s beneath a proven folder', async (definition) => {
    const server = new Server();
    await server.run('/element', JSON.stringify({ definitionId: definition, parentElementId: parent, name: 'Documento', open: true, locked: false, vendorId: resource }), 'application/json');
  });

  it.each([definitions.location, resource])('rejects unaudited creation definition %s', async (definition) => {
    await expect(new Server().run('/element', JSON.stringify({ definitionId: definition, parentElementId: parent, name: 'Documento' }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('rejects creation under a known crew parent', async () => {
    const server = new Server();
    server.tables.flex_crew_calls = [{ flex_element_id: parent }];
    await expect(server.run('/element', JSON.stringify({ definitionId: definitions.subFolder, parentElementId: parent, name: 'Documento' }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('preserves new crew document provisioning with the audited folder payload', async () => {
    const server = new Server();
    await server.run('/element', JSON.stringify({ definitionId: definitions.crewCall, parentElementId: parent,
      open: true, locked: false, name: 'Crew Call Sonido', plannedStartDate: '2026-10-04', plannedEndDate: '2026-10-05',
      departmentId: resource, personResponsibleId: resource, locationId: resource, documentNumber: '26CCS',
    }), 'application/json');
    expect(server.providerCalls.every((call) => call.init.method === 'GET')).toBe(true);
  });

  it.each(['elementId', 'id', 'lineItemId', 'crewCallId'])('new crew creation cannot select an existing identity through %s', async (key) => {
    await expect(new Server().run('/element', JSON.stringify({ definitionId: definitions.crewCall, parentElementId: parent,
      open: true, locked: false, name: 'Crew', [key]: id,
    }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('a newly creatable crew definition is still refused as an existing membership target', async () => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.crewCall));
    await expect(server.run(addPath(), form({ managedResourceLineItemType: 'contact' }))).rejects.toMatchObject({ status: 409 });
    await expect(server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: 'business-role', payloadValue: resource }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('allows the existing tour-root customField payload with its audited ID and boolean value', async () => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.mainFolder));
    await server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: 'customField', customFieldId: FLEX_CUSTOM_FIELD_IDS.isTour,
      payloadValue: true, displayValue: 'true',
    }), 'application/json');
  });

  it.each([
    { customFieldId: resource, payloadValue: true },
    { customFieldId: FLEX_CUSTOM_FIELD_IDS.projectDiscount, payloadValue: 10 },
    { customFieldId: FLEX_CUSTOM_FIELD_IDS.isTour, payloadValue: 'true' },
    { customFieldId: FLEX_CUSTOM_FIELD_IDS.isTour, payloadValue: true, displayValue: 'false' },
    { customFieldId: FLEX_CUSTOM_FIELD_IDS.isTour, payloadValue: true, lineItemId: line },
  ])('rejects unsupported IDs or malformed tour customField shape %j', async (fields) => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.mainFolder));
    await expect(server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: 'customField', ...fields }), 'application/json')).rejects.toMatchObject({ status: expect.toBeOneOf([400, 409]) });
  });

  it('allows safe headers and rejects structural or contact header fields', async () => {
    const server = new Server();
    await server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: 'plannedStartDate', payloadValue: '2026-10-04', displayValue: '2026-10-04' }), 'application/json');
    for (const field of ['definitionId', 'parentElementId', 'business-role', 'contact']) {
      await expect(server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: field, payloadValue: resource }), 'application/json')).rejects.toMatchObject({ status: 409 });
    }
  });

  it.each(['flex_crew_calls', 'flex_crew_reconciliation_gates', 'provider-only'])('preserves the four actual crew metadata headers for %s without membership RPCs', async (table) => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.crewCall));
    if (table !== 'provider-only') server.tables[table] = [{ flex_element_id: id }];
    for (const field of ['name', 'documentNumber', 'plannedStartDate', 'plannedEndDate']) {
      const value = field.startsWith('planned') ? '2026-10-04' : 'Crew Call Sonido';
      await server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: field, payloadValue: value, displayValue: value }), 'application/json');
    }
    expect(server.providerCalls.every((call) => call.init.method === 'GET')).toBe(true);
    expect(server.queries.every((url) => !url.pathname.includes('/rpc/'))).toBe(true);
  });

  it.each(['contact', 'business-role', 'parentElementId', 'definitionId', 'customField', 'documentName'])('crew metadata exception does not admit field %s', async (field) => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.crewCall));
    server.tables.flex_crew_reconciliation_gates = [{ flex_element_id: id }];
    await expect(server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: field, payloadValue: resource }), 'application/json')).rejects.toMatchObject({ status: expect.toBeOneOf([400, 409]) });
  });

  it.each(['parentElementId', 'lineItemId', 'elementId', 'businessRoleId'])('crew metadata exception rejects extra target/role reference %s', async (key) => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.crewCall));
    await expect(server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: 'name', payloadValue: 'Crew', [key]: other }), 'application/json')).rejects.toMatchObject({ status: 409 });
  });

  it('crew header tombstone cannot override conflicting provider identity or definition', async () => {
    const server = new Server();
    server.tables.flex_crew_reconciliation_gates = [{ flex_element_id: id }];
    for (const metadata of [meta(other, definitions.crewCall), meta(id, definitions.pullSheet)]) {
      server.metadata.set(id, metadata);
      await expect(server.run(`/element/${id}/header-update`, JSON.stringify({ fieldType: 'name', payloadValue: 'Crew' }), 'application/json')).rejects.toMatchObject({ status: 409 });
    }
  });

  it('allows deletion only after proving a complete noncrew subtree', async () => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.subFolder));
    server.metadata.set(other, meta(other, definitions.pullSheet, id));
    server.tree = [{ elementId: id, children: [{ elementId: other, parentElementId: id, leaf: true }] }];
    await server.run(`/element/${id}`, undefined, '', 'DELETE');
  });

  it.each(['mapped crew', 'tombstone', 'provider crew'])('rejects parent deletion containing %s', async (kind) => {
    const server = new Server();
    server.metadata.set(id, meta(id, definitions.subFolder));
    server.metadata.set(other, meta(other, kind === 'provider crew' ? definitions.crewCall : definitions.pullSheet, id));
    if (kind !== 'provider crew') server.tables[kind === 'tombstone' ? 'flex_crew_reconciliation_gates' : 'flex_crew_calls'] = [{ flex_element_id: other }];
    server.tree = [{ elementId: id, children: [{ elementId: other, leaf: true }] }];
    await expect(server.run(`/element/${id}`, undefined, '', 'DELETE')).rejects.toMatchObject({ status: 409 });
  });

  it.each([[], {}, [{ elementId: id, leaf: false }], [{ elementId: id, children: [] }], [{ elementId: other, leaf: true }]])('refuses incomplete or unrelated deletion tree %j', async (tree) => {
    const server = new Server();
    server.tree = tree;
    await expect(server.run(`/element/${id}`, undefined, '', 'DELETE')).rejects.toMatchObject({ status: 409 });
  });
});
