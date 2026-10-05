import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

type Row = Record<string, unknown>;
type Kind = 'folder' | 'pullsheet' | 'financial' | 'other' | 'crew';
interface Element { id: string; definition: string; kind: Kind; parent?: string }
export interface FlexMutationInspection {
  apiBaseUrl: string;
  body?: string;
  contentType?: string;
  /** Credentialed GET transport supplied by the adapter. Never persisted. */
  fetch: typeof fetch;
}

// Audited definitions from src/utils/flex-folders/constants.ts. Location and
// responsible-person IDs are not element definitions and are excluded.
const DEFINITIONS: Record<string, Kind> = {
  'e281e71c-2c42-49cd-9834-0eb68135e9ac': 'folder', // mainFolder
  '358f312c-b051-11df-b8d5-00e08175e43e': 'folder', // subFolder
  '3787806c-af2d-11df-b8d5-00e08175e43e': 'folder', // documentation
  'a220432c-af33-11df-b8d5-00e08175e43e': 'pullsheet',
  '9bfb850c-b117-11df-b8d5-00e08175e43e': 'financial', // presupuesto
  'fb8b82c9-41d6-4b8f-99b6-4ab8276d06aa': 'financial', // dryhire presupuesto
  'f6e70edc-f42d-11e0-a8de-00e08175e43e': 'financial', // ordenTrabajo
  '566d32e0-1a1e-11e0-a472-00e08175e43e': 'other', // hojaGastos
  'ff1a5a50-3f1d-11df-b8d5-00e08175e43e': 'other', // ordenCompra
  '7e2ae0d0-b0bc-11df-b8d5-00e08175e43e': 'other', // ordenSubalquiler
};
const CREW = '253878cc-af31-11df-b8d5-00e08175e43e';
const TOUR_FLAG = '41ef9116-0cee-48d3-b47d-f3308295c85b';
const LOCAL_DEFINITIONS: Record<string, string> = {
  main: 'e281e71c-2c42-49cd-9834-0eb68135e9ac', main_event: 'e281e71c-2c42-49cd-9834-0eb68135e9ac',
  department: '358f312c-b051-11df-b8d5-00e08175e43e', tour_department: '358f312c-b051-11df-b8d5-00e08175e43e',
  tourdate: '358f312c-b051-11df-b8d5-00e08175e43e', dryhire: '358f312c-b051-11df-b8d5-00e08175e43e',
  work_orders: '358f312c-b051-11df-b8d5-00e08175e43e', pull_sheet: 'a220432c-af33-11df-b8d5-00e08175e43e',
  comercial_presupuesto: '9bfb850c-b117-11df-b8d5-00e08175e43e', dryhire_presupuesto: 'fb8b82c9-41d6-4b8f-99b6-4ab8276d06aa',
  crew_call: CREW,
};
const LINE_TYPES = new Set(['inventory-model', 'service-offering', 'note']);
const ADD_KEYS = ['resourceParentId', 'managedResourceLineItemType', 'quantity', 'parentLineItemId', 'nextSiblingId'];
const HEADER_FIELDS = new Set(['name', 'documentName', 'documentNumber', 'plannedStartDate', 'plannedEndDate']);
const LINE_FIELDS = new Set(['pricingModel', 'pricing-model', 'timeQty', 'time-qty', 'quantity']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deny(): never {
  throw new HttpError(409, 'Flex mutation is not allowlisted or targets managed crew membership', { code: 'flex_crew_reconciliation_required' });
}
function malformed(): never { throw new HttpError(400, 'Invalid or conflicting Flex mutation payload'); }
function unavailable(): never { throw new HttpError(503, 'Could not verify Flex mutation metadata'); }
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return malformed();
  return value as Row;
}
function unwrap(value: unknown): unknown {
  return value && typeof value === 'object' && !Array.isArray(value) && 'data' in value ? (value as Row).data : value;
}
function uuid(value: unknown): string {
  const unwrapped = unwrap(value);
  if (typeof unwrapped !== 'string' || !UUID.test(unwrapped)) return malformed();
  return unwrapped.toLowerCase();
}
function identity(data: Row, keys: string[]): string | undefined {
  const values = keys.filter((key) => data[key] != null).map((key) => uuid(data[key]));
  if (new Set(values).size > 1) return deny();
  return values[0];
}
function only(data: Row, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) deny();
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return malformed();
  return value;
}
function numeric(value: unknown, positive = false) {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '' || !Number.isFinite(Number(value)) || (positive ? Number(value) <= 0 : Number(value) < 0)) malformed();
}

// JSON.parse erases duplicate keys. Walk its already-validated source tokens
// so escaped spellings and nested bulkData duplicates also fail.
function parseJson(source: string): Row {
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { return malformed(); }
  let i = 0;
  const space = () => { while (i < source.length && /\s/.test(source[i])) i++; };
  const quoted = () => {
    const start = i++;
    while (i < source.length) {
      if (source[i++] === '\\') i++;
      else if (source[i - 1] === '"') break;
    }
    return JSON.parse(source.slice(start, i)) as string;
  };
  const value = (depth: number) => {
    if (depth > 20) malformed();
    space();
    if (source[i] === '{') {
      i++; space();
      const seen = new Set<string>();
      while (source[i] !== '}') {
        const key = quoted();
        if (seen.has(key)) malformed();
        seen.add(key); space(); i++; value(depth + 1); space();
        if (source[i] !== ',') break;
        i++; space();
      }
      i++;
    } else if (source[i] === '[') {
      i++; space();
      while (source[i] !== ']') {
        value(depth + 1); space();
        if (source[i] !== ',') break;
        i++; space();
      }
      i++;
    } else if (source[i] === '"') quoted();
    else { while (i < source.length && !/[\s,}\]]/.test(source[i])) i++; }
  };
  value(0);
  return row(parsed);
}
function parameters(params: URLSearchParams): Row {
  const result: Row = Object.create(null);
  for (const [key, value] of params) {
    if (Object.hasOwn(result, key)) malformed();
    result[key] = value;
  }
  return result;
}
function payload(url: URL, inspection: FlexMutationInspection): Row {
  const query = parameters(url.searchParams);
  let body: Row = {};
  if (inspection.body) {
    const type = inspection.contentType?.split(';')[0].trim().toLowerCase();
    if (type === 'application/json') body = parseJson(inspection.body);
    else if (type === 'application/x-www-form-urlencoded') body = parameters(new URLSearchParams(inspection.body));
    else malformed();
  }
  for (const [key, value] of Object.entries(body)) {
    if (Object.hasOwn(query, key) && (typeof value === 'object' || String(query[key]) !== String(value))) malformed();
  }
  return { ...query, ...body };
}

/** Positive trusted classification plus a finite existing-operation allowlist.
 * Existing crew membership/roles and structural mutations are denied. Crew
 * name/documentNumber/planned dates are metadata-only and do not enter the
 * membership gate. New document creation never selects an existing identity.
 * Inspection performs only bounded GETs; credentials are never persisted.
 */
export async function assertNotCrewMutation(
  client: SupabaseClient, target: URL, method: string, inspection: FlexMutationInspection,
): Promise<void> {
  if (method === 'GET') return;
  const base = new URL(inspection.apiBaseUrl);
  const basePath = base.pathname.replace(/\/$/, '');
  if (target.origin !== base.origin || !target.pathname.startsWith(`${basePath}/`) || target.hash || target.username || target.password) malformed();
  const path = target.pathname.slice(basePath.length).replace(/\/$/, '');
  const data = payload(target, inspection);
  const deadline = Date.now() + 30_000;
  async function bounded<T>(task: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
    const ms = Math.min(10_000, deadline - Date.now());
    if (ms <= 0) return unavailable();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => task(controller.signal)),
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(new HttpError(503, 'Could not verify Flex mutation metadata'));
        }, ms); }),
      ]);
    } catch { return unavailable(); }
    finally { clearTimeout(timer); }
  }
  async function get(endpoint: string): Promise<unknown> {
    return bounded(async (signal) => {
      const response = await inspection.fetch(`${base.origin}${basePath}${endpoint}`, { method: 'GET', signal, redirect: 'error' });
      if (!response.ok) unavailable();
      const body = await response.text(); // Body consumption is inside the deadline.
      if (body.length > 1_000_000) unavailable();
      return JSON.parse(body) as unknown;
    });
  }
  async function lookup(table: string, id: string, workOrder = false): Promise<Row[]> {
    const result = await bounded((signal) => {
      const query = client.from(table).select('*');
      return (workOrder ? query.or(`flex_document_id.eq.${id},flex_element_id.eq.${id}`)
        : query.eq(table === 'flex_crew_calls' || table === 'flex_crew_reconciliation_gates' ? 'flex_element_id' : 'element_id', id))
        .limit(100).abortSignal(signal);
    });
    if (result.error || !Array.isArray(result.data) || result.data.length >= 100) unavailable();
    return result.data.map(row);
  }
  const cache = new Map<string, Element>();
  async function classify(id: string, crewHeader = false): Promise<Element> {
    if (cache.has(id)) return cache.get(id)!;
    const [calls, gates] = await Promise.all([lookup('flex_crew_calls', id), lookup('flex_crew_reconciliation_gates', id)]);
    if ((calls.length || gates.length) && !crewHeader) deny();
    const [folders, orders] = await Promise.all([lookup('flex_folders', id), lookup('flex_work_orders', id, true)]);
    const local: string[] = crewHeader && (calls.length || gates.length) ? [CREW] : [];
    for (const folder of folders) {
      if (uuid(folder.element_id) !== id) deny();
      const definition = LOCAL_DEFINITIONS[String(folder.folder_type)];
      if (definition === CREW && !crewHeader) deny();
      if (definition) local.push(definition);
    }
    for (const order of orders) {
      if (uuid(order.flex_document_id) !== id && uuid(order.flex_element_id) !== id) deny();
      local.push('f6e70edc-f42d-11e0-a8de-00e08175e43e');
    }
    if (new Set(local).size > 1) deny();
    const meta = row(await get(`/element/${id}/key-info/`));
    const remoteId = identity(meta, ['id', 'elementId']);
    const remoteDefinition = identity(meta, ['definitionId', 'elementDefinitionId']);
    if (remoteId && remoteId !== id) deny();
    if ((remoteDefinition === CREW && !crewHeader) || (remoteDefinition && local.length && remoteDefinition !== local[0])) deny();
    // API semantic assumption: the exact credentialed, nonredirecting key-info
    // route binds this definition to the requested UUID. Flex often omits a
    // redundant ID field. Any returned ID must still agree. Proven local records
    // may fill missing definition fields, never override a provider conflict.
    const definition = remoteDefinition ?? local[0];
    if (!definition || (definition === CREW ? !crewHeader : !Object.hasOwn(DEFINITIONS, definition))) deny();
    const parent = identity(meta, ['parentElementId', 'parentId']);
    const orderParents = orders.map((order) => uuid(order.folder_element_id));
    if (new Set(orderParents).size > 1 || (parent && orderParents.length && parent !== orderParents[0])) deny();
    const result: Element = { id, definition, kind: definition === CREW ? 'crew' : DEFINITIONS[definition], parent: parent ?? orderParents[0] };
    cache.set(id, result);
    return result;
  }
  async function members(id: string, family: string): Promise<Map<string, Row>> {
    const value = await get(`/${family}/${id}/row-data/?node=root&codeList=contact&codeList=quantity&codeList=notes`);
    if (!Array.isArray(value)) deny();
    const result = new Map<string, Row>();
    const walk = (values: unknown[], depth: number) => {
      if (depth > 12) deny();
      for (const v of values) {
        if (result.size >= 1000) deny();
        const item = row(v);
        const line = identity(item, ['id', 'lineItemId']);
        if (!line || result.has(line)) deny();
        const owner = identity(item, ['elementId', 'documentId', 'financialDocumentId']);
        if (owner && owner !== id) deny();
        result.set(line, item);
        if (item.children != null) {
          if (!Array.isArray(item.children)) deny();
          walk(item.children, depth + 1);
        }
      }
    };
    walk(value, 0);
    return result;
  }
  async function verifyLines(id: string, family: string, ids: string[]) {
    if (!ids.length) return;
    const rows = await members(id, family);
    for (const line of ids) {
      const [calls, gates] = await Promise.all([lookup('flex_crew_calls', line), lookup('flex_crew_reconciliation_gates', line)]);
      if (calls.length || gates.length) deny();
      const item = rows.get(line);
      if (!item) deny();
      const types = [item.managedResourceLineItemType, item.type].filter((v) => v != null).map((v) => text(unwrap(v)).toLowerCase());
      if (new Set(types).size !== 1 || !LINE_TYPES.has(types[0]) || (family === 'line-item' && types[0] !== 'inventory-model')) deny();
    }
  }
  async function references(element: Element, family: string, fields: Row) {
    const ids = ['parentLineItemId', 'nextSiblingId'].filter((key) => fields[key] != null && fields[key] !== '').map((key) => uuid(fields[key]));
    await verifyLines(element.id, family, ids);
    if (fields.resourceParentId != null && fields.resourceParentId !== '') {
      const parent = uuid(fields.resourceParentId);
      if ((await classify(parent)).kind !== 'folder' || (element.parent && parent !== element.parent)) deny();
      if (!element.parent) {
        // Newly created work orders are not tracked yet, and key-info can omit
        // parentElementId too. Prove the direct relationship through the existing
        // trusted tree API rather than accepting a caller's parent assertion.
        const tree = await get(`/element/${parent}/tree`);
        if (!Array.isArray(tree)) deny();
        const matches: Row[] = [];
        for (const value of tree) {
          const node = row(value);
          const root = identity(node, ['elementId', 'nodeId', 'id']);
          if (root === parent) {
            if (!Array.isArray(node.children)) deny();
            for (const child of node.children) {
              const childRow = row(child);
              if (identity(childRow, ['elementId', 'nodeId', 'id']) === element.id) matches.push(childRow);
            }
          } else if (root === element.id && identity(node, ['parentElementId', 'parentId']) === parent) matches.push(node);
        }
        if (matches.length !== 1) deny();
        const provenParent = identity(matches[0], ['parentElementId', 'parentId']);
        const provenDefinition = identity(matches[0], ['definitionId', 'elementDefinitionId']);
        if ((provenParent && provenParent !== parent) || (provenDefinition && provenDefinition !== element.definition)) deny();
      }
    }
  }

  if (path === '/element') {
    if (method !== 'POST') deny();
    only(data, ['definitionId', 'parentElementId', 'open', 'locked', 'name', 'documentNumber', 'plannedStartDate', 'plannedEndDate', 'personResponsibleId', 'locationId', 'venueId', 'vendorId', 'currencyId', 'departmentId']);
    const definition = uuid(data.definitionId);
    // Creating a new physical crew document cannot replay an existing crew
    // decision. No caller-selected element/line identity is accepted here.
    if (definition !== CREW && !Object.hasOwn(DEFINITIONS, definition)) deny();
    text(data.name);
    if (definition === CREW && (typeof data.open !== 'boolean' || typeof data.locked !== 'boolean')) malformed();
    for (const key of ['open', 'locked']) if (data[key] != null && typeof data[key] !== 'boolean') malformed();
    for (const key of ['personResponsibleId', 'locationId', 'venueId', 'vendorId', 'currencyId', 'departmentId']) if (data[key] != null && data[key] !== '') uuid(data[key]);
    for (const key of ['documentNumber', 'plannedStartDate', 'plannedEndDate']) if (data[key] != null) text(data[key]);
    if (data.parentElementId != null && data.parentElementId !== '') {
      if ((await classify(uuid(data.parentElementId))).kind !== 'folder') deny();
    } else if (definition !== 'e281e71c-2c42-49cd-9834-0eb68135e9ac') deny();
    return;
  }
  const match = /^\/(element|line-item|financial-document-line-item)\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?$/.exec(path);
  if (!match) deny();
  const [, family, rawId, operation, rawResource] = match;
  const id = uuid(rawId);
  if (family === 'line-item' && (method !== 'POST' || operation !== 'add-resource' || !rawResource)) deny();
  if (family === 'financial-document-line-item' && (method !== 'POST' || !['add-resource', 'bulk-update', 'update', 'row-data', 'add-note'].includes(operation))) deny();
  if (family === 'element' && !((method === 'DELETE' && !operation) || (method === 'POST' && operation === 'header-update' && !rawResource))) deny();
  const crewHeader = family === 'element' && method === 'POST' && operation === 'header-update';
  const element = await classify(id, crewHeader);
  if (family === 'element') {
    if (operation === 'header-update') {
      if (data.fieldType === 'customField') {
        only(data, ['fieldType', 'customFieldId', 'payloadValue', 'displayValue']);
        if (element.definition !== 'e281e71c-2c42-49cd-9834-0eb68135e9ac' || uuid(data.customFieldId) !== TOUR_FLAG) deny();
        if (typeof data.payloadValue !== 'boolean' || (data.displayValue != null && data.displayValue !== String(data.payloadValue))) malformed();
        return;
      }
      only(data, ['fieldType', 'payloadValue', 'displayValue']);
      const field = text(data.fieldType);
      if (!HEADER_FIELDS.has(field) || (element.kind === 'crew' && field === 'documentName')) deny();
      text(data.payloadValue);
      if (data.displayValue != null && data.displayValue !== data.payloadValue) malformed();
      return;
    }
    only(data, []);
    const tree = await get(`/element/${id}/tree`);
    if (!Array.isArray(tree) || !tree.length) deny();
    const seen = new Set<string>();
    const walk = async (nodes: unknown[], parent?: string, depth = 0) => {
      if (depth > 12) deny();
      for (const value of nodes) {
        const node = row(value);
        const child = identity(node, ['elementId', 'nodeId', 'id']);
        if (!child || seen.has(child) || seen.size >= 100) deny();
        seen.add(child);
        const classified = await classify(child);
        const treeDefinition = identity(node, ['definitionId', 'elementDefinitionId']);
        const treeParent = identity(node, ['parentElementId', 'parentId']);
        if ((treeDefinition && treeDefinition !== classified.definition) || (parent && treeParent && treeParent !== parent) || (parent && classified.parent && classified.parent !== parent)) deny();
        if (node.children != null && !Array.isArray(node.children)) deny();
        const children = node.children as unknown[] | undefined;
        if (!children?.length && node.leaf !== true) deny(); // Lazy nodes cannot prove subtree safety.
        if (children?.length) await walk(children, child, depth + 1);
      }
    };
    await walk(tree);
    if (!seen.has(id)) deny();
    return;
  }
  if (element.kind !== (family === 'line-item' ? 'pullsheet' : 'financial')) deny();
  if (operation === 'add-resource') {
    if (!rawResource) deny();
    uuid(rawResource);
    only(data, ADD_KEYS);
    const type = text(data.managedResourceLineItemType);
    if (!(family === 'line-item' ? type === 'inventory-model' : ['inventory-model', 'service-offering'].includes(type))) deny();
    numeric(data.quantity, true);
    await references(element, family, data);
  } else if (operation === 'bulk-update') {
    if (rawResource) deny();
    only(data, ['bulkData']);
    if (!Array.isArray(data.bulkData) || !data.bulkData.length || data.bulkData.length > 100) malformed();
    const ids: string[] = [];
    for (const value of data.bulkData) {
      const update = row(value);
      only(update, ['itemId', 'alternatePickupDate', 'alternateReturnDate', 'timeQty', 'quantity']);
      if (Object.keys(update).length < 2) malformed();
      ids.push(uuid(update.itemId));
      for (const key of ['quantity', 'timeQty']) if (Object.hasOwn(update, key)) numeric(update[key]);
      for (const key of ['alternatePickupDate', 'alternateReturnDate']) if (Object.hasOwn(update, key)) text(update[key]);
    }
    if (new Set(ids).size !== ids.length) malformed();
    await verifyLines(id, family, ids);
  } else if (operation === 'update' || operation === 'row-data') {
    if (rawResource) deny();
    only(data, ['lineItemId', 'fieldType', 'payloadValue']);
    const field = text(data.fieldType);
    if (!LINE_FIELDS.has(field)) deny();
    if (field === 'pricingModel' || field === 'pricing-model') uuid(data.payloadValue);
    else numeric(data.payloadValue);
    await verifyLines(id, family, [uuid(data.lineItemId)]);
  } else if (operation === 'add-note') {
    if (rawResource) deny();
    only(data, ['note']);
    text(data.note);
  } else deny();
}
