import { supabase } from '@/integrations/supabase/client';
import { FLEX_API_BASE_URL } from '@/lib/api-config';
import { FLEX_FOLDER_IDS, RESPONSIBLE_PERSON_IDS, DEPARTMENT_SUFFIXES } from '@/utils/flex-folders/constants';
import { resourceIdForRole, EXTRA_RESOURCE_IDS } from '@/utils/flex-labor-resources';

const WORK_ORDER_DEFINITION_ID = FLEX_FOLDER_IDS.ordenTrabajo;
const DEFAULT_LOCATION_ID = FLEX_FOLDER_IDS.location;
const PERSONNEL_RESPONSIBLE_ID = RESPONSIBLE_PERSON_IDS.personnel;
const CURRENCY_EUR_ID = 'd3d53320-6926-11ea-9bb5-2a0a4490a7fb';
const PRICING_MODEL_BASE_2025_ID = 'a4307bf9-cd39-4df1-9d6d-48932120c4bd';
const PRICING_MODEL_DIA_TOUR_ID = '04c62780-c51d-11ea-a087-2a0a4490a7fb';

let cachedFlexToken: string | null = null;

async function getFlexAuthToken(): Promise<string> {
  if (cachedFlexToken) return cachedFlexToken;

  const { data, error } = await supabase.functions.invoke('get-secret', {
    body: { secretName: 'X_AUTH_TOKEN' },
  });

  if (error) {
    throw new Error(error.message || 'Failed to resolve Flex auth token');
  }

  const token = (data as { X_AUTH_TOKEN?: string } | null)?.X_AUTH_TOKEN;
  if (!token) {
    throw new Error('Flex auth token response missing X_AUTH_TOKEN');
  }

  cachedFlexToken = token;
  return token;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function technicianDisplayName(profile?: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const first = profile?.first_name?.trim();
  const last = profile?.last_name?.trim();
  const combined = [first, last].filter(Boolean).join(' ');
  return combined || 'Sin nombre';
}

function normalizeProfileRow<T extends Record<string, any> | null | undefined>(profile: T) {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] : profile;
}

interface TimesheetCrewRow {
  technician_id: string | null;
  date: string;
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
    flex_resource_id?: string | null;
    department?: string | null;
  } | null;
}

async function createWorkOrderElement(options: {
  parentElementId: string;
  job: { id: string; title: string; start_time: string; end_time: string; location_id: string | null };
  technicianName: string;
  vendorId: string;
  token: string;
}): Promise<{ documentId: string; raw: any }>
{
  const { parentElementId, job, technicianName, vendorId, token } = options;
  const plannedStartDate = formatDate(job.start_time) ?? new Date().toISOString().slice(0, 10);
  const plannedEndDate = formatDate(job.end_time) ?? plannedStartDate;

  const payload = {
    definitionId: WORK_ORDER_DEFINITION_ID,
    parentElementId,
    open: true,
    locked: false,
    name: `Orden de Trabajo - ${job.title} (${technicianName})`,
    personResponsibleId: PERSONNEL_RESPONSIBLE_ID,
    vendorId: vendorId,
    currencyId: CURRENCY_EUR_ID,
  };

  const response = await fetch(`${FLEX_API_BASE_URL}/element`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Auth-Token': token,
      'apikey': token,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message = errorPayload?.exceptionMessage || response.statusText || 'Failed to create work order';
    throw new Error(message);
  }

  const raw = await response.json().catch(() => ({}));
  const documentId =
    raw?.id || raw?.elementId || raw?.data?.id || raw?.data?.elementId || raw?.element?.id || null;
  const documentNumber = raw?.documentNumber || raw?.elementNumber || raw?.number || raw?.data?.documentNumber || null;

  if (!documentId) {
    throw new Error('Flex work order creation succeeded without returning an element id');
  }

  return { documentId, raw: { ...raw, documentNumber } };
}

async function fetchDocumentNumber(documentId: string, token: string): Promise<string | null> {
  const url = `${FLEX_API_BASE_URL}/element/${encodeURIComponent(documentId)}/key-info/`;
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token, 'apikey': token } });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null) as any;
    const docNum = j?.documentNumber?.data || j?.documentNumber || null;
    return (typeof docNum === 'string' && docNum.trim()) ? docNum : null;
  } catch (_) {
    return null;
  }
}

async function addResourceLineItem(options: {
  documentId: string;
  parentElementId: string;
  resourceId: string;
  quantity?: number;
  token: string;
  managedResourceLineItemType?: string;
  parentLineItemId?: string;
}): Promise<string | null> {
  const { documentId, parentElementId, resourceId, quantity = 1, token, managedResourceLineItemType = 'service-offering', parentLineItemId } = options;
  const baseUrl = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/add-resource/${encodeURIComponent(resourceId)}`;
  const query = new URLSearchParams({
    resourceParentId: parentElementId,
    managedResourceLineItemType,
    quantity: String(quantity),
  });

  const tryRequest = async (init: RequestInit): Promise<any | null> => {
    try {
      const res = await fetch(`${baseUrl}?${query.toString()}`, init);
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch (err) {
      console.error('[FlexWorkOrders] Failed to add resource line item', err);
      return null;
    }
  };

  const headers = { accept: '*/*', 'X-Auth-Token': token, 'apikey': token } as Record<string, string>;
  let payload: any | null = null;
  if (!parentLineItemId) {
    // Try JSON path first when not nesting under a parent line
    payload = await tryRequest({ method: 'POST', headers });
  }

  if (!payload) {
    const fallbackHeaders = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    };
    const form = new URLSearchParams({
      resourceParentId: parentElementId,
      managedResourceLineItemType,
      quantity: String(quantity),
      parentLineItemId: parentLineItemId ?? '',
      nextSiblingId: '',
    });
    payload = await tryRequest({ method: 'POST', headers: fallbackHeaders, body: form.toString() });
  }

  if (!payload) return null;
  return (
    payload?.id ||
    payload?.lineItemId ||
    payload?.data?.id ||
    (Array.isArray(payload?.addedResourceLineIds) ? payload.addedResourceLineIds[0] : null)
  );
}

async function updateLineItemDates(options: {
  documentId: string;
  lineItemId: string;
  pickupDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  token: string;
}): Promise<boolean> {
  const { documentId, lineItemId, pickupDate, returnDate, token } = options;
  const url = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/bulk-update`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        'X-Auth-Token': token,
        'apikey': token,
      },
      body: JSON.stringify({
        bulkData: [{ itemId: lineItemId, alternatePickupDate: pickupDate, alternateReturnDate: returnDate }],
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[FlexWorkOrders] Failed to update line item dates', err);
    return false;
  }
}

async function setLineItemPricingModel(options: {
  documentId: string;
  lineItemId: string;
  pricingModelId: string;
  token: string;
}): Promise<boolean> {
  const { documentId, lineItemId, pricingModelId, token } = options;
  const rowDataUrl = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/row-data/`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Auth-Token': token,
      'apikey': token,
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
    } as Record<string,string>;
    // First try dedicated update endpoint with camelCase field (per working example)
    const ok = await updateLineItemField({ documentId, lineItemId, fieldType: 'pricingModel', payloadValue: pricingModelId, token });
    if (ok) return true;

    // Fallback to row-data camelCase
    let res = await fetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'pricingModel', payloadValue: pricingModelId }),
    });
    if (res.ok) return true;

    // Fallback to kebab-case on row-data
    res = await fetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'pricing-model', payloadValue: pricingModelId }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[FlexWorkOrders] Failed to set pricing model on line item', err);
    return false;
  }
}

async function setLineItemTimeQty(options: {
  documentId: string;
  lineItemId: string;
  timeQty: number;
  token: string;
}): Promise<boolean> {
  const { documentId, lineItemId, timeQty, token } = options;
  const rowDataUrl = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/row-data/`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Auth-Token': token,
      'apikey': token,
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
    } as Record<string,string>;
    // Try dedicated update endpoint first (as per working payload)
    const ok = await updateLineItemField({ documentId, lineItemId, fieldType: 'timeQty', payloadValue: timeQty, token });
    if (ok) return true;
    // Try canonical camelCase key first (as seen in Flex payloads)
    let res = await fetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'timeQty', payloadValue: timeQty }),
    });
    if (res.ok) return true;

    // Fallback to kebab-case variant some environments expect
    res = await fetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'time-qty', payloadValue: timeQty }),
    });
    if (res.ok) return true;

    // Last fallback: send as string payload
    res = await fetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'timeQty', payloadValue: String(timeQty) }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[FlexWorkOrders] Failed to set time qty on line item', err);
    return false;
  }
}

async function setLineItemTimeQtyBulk(options: {
  documentId: string;
  lineItemId: string;
  timeQty: number;
  token: string;
}): Promise<boolean> {
  const { documentId, lineItemId, timeQty, token } = options;
  const url = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/bulk-update`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        'X-Auth-Token': token,
        'apikey': token,
        'X-Requested-With': 'XMLHttpRequest',
        'X-API-Client': 'flex5-desktop',
      },
      body: JSON.stringify({ bulkData: [{ itemId: lineItemId, timeQty }] }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[FlexWorkOrders] Failed bulk-update timeQty on line item', err);
    return false;
  }
}

async function updateLineItemField(options: {
  documentId: string;
  lineItemId: string;
  fieldType: string;
  payloadValue: string | number;
  token: string;
}): Promise<boolean> {
  const { documentId, lineItemId, fieldType, payloadValue, token } = options;
  const url = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/update`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'X-Auth-Token': token,
        'apikey': token,
        'X-Requested-With': 'XMLHttpRequest',
        'X-API-Client': 'flex5-desktop',
      },
      body: JSON.stringify({ lineItemId, fieldType, payloadValue }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[FlexWorkOrders] Failed update on line item field', fieldType, err);
    return false;
  }
}

async function setLineItemQuantityRow(options: {
  documentId: string;
  lineItemId: string;
  quantity: number;
  token: string;
}): Promise<boolean> {
  const { documentId, lineItemId, quantity, token } = options;
  const rowDataUrl = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/row-data/`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Auth-Token': token,
      'apikey': token,
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
    } as Record<string,string>;
    // Try dedicated update endpoint first
    const ok = await updateLineItemField({ documentId, lineItemId, fieldType: 'quantity', payloadValue: quantity, token });
    if (ok) return true;
    let res = await fetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'quantity', payloadValue: quantity }),
    });
    if (res.ok) return true;
    res = await fetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'quantity', payloadValue: String(quantity) }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[FlexWorkOrders] Failed to set quantity via row-data', err);
    return false;
  }
}

async function setLineItemQuantityBulk(options: {
  documentId: string;
  lineItemId: string;
  quantity: number;
  token: string;
}): Promise<boolean> {
  const { documentId, lineItemId, quantity, token } = options;
  const url = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/bulk-update`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        'X-Auth-Token': token,
        'apikey': token,
        'X-Requested-With': 'XMLHttpRequest',
        'X-API-Client': 'flex5-desktop',
      },
      body: JSON.stringify({ bulkData: [{ itemId: lineItemId, quantity }] }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[FlexWorkOrders] Failed bulk-update quantity on line item', err);
    return false;
  }
}

async function addExtraNoteLineItem(options: {
  documentId: string;
  note: string;
  token: string;
}): Promise<void> {
  const { documentId, note, token } = options;
  const url = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/add-note`;

  const tryJson = async () => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          'X-Auth-Token': token,
          'apikey': token,
        },
        body: JSON.stringify({ note }),
      });
      if (res.ok) return true;
    } catch (err) {
      console.error('[FlexWorkOrders] Failed to add note line item (json)', err);
    }
    return false;
  };

  const ok = await tryJson();
  if (ok) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        accept: '*/*',
        'X-Auth-Token': token,
        'apikey': token,
      },
      body: new URLSearchParams({ note }).toString(),
    });
    if (!res.ok) {
      console.warn('[FlexWorkOrders] Unable to append extras note to work order');
    }
  } catch (err) {
    console.error('[FlexWorkOrders] Failed to add note line item (fallback)', err);
  }
}

export interface FlexWorkOrderSyncResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface AssignmentRow {
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  status: string | null;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    flex_resource_id?: string | null;
    department?: string | null;
  } | null;
}

interface ExtraRow {
  technician_id: string;
  extra_type: string;
  quantity: number;
  status: string;
}

export async function syncFlexWorkOrdersForJob(jobId: string): Promise<FlexWorkOrderSyncResult> {
  if (!jobId) {
    throw new Error('Job id is required to sync Flex work orders');
  }

  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  const token = await getFlexAuthToken();

  const [{ data: job, error: jobError }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, start_time, end_time, location_id, job_type, tour_date_id')
      .eq('id', jobId)
      .maybeSingle(),
  ]);

  if (jobError) throw jobError;
  if (!job) throw new Error('Job not found');

  // Determine search criteria based on job type
  const searchCriteria: any = { folder_type: 'work_orders', department: 'personnel' };

  if (job.job_type === 'tourdate') {
    if (!job.tour_date_id) {
      throw new Error(`Tourdate job ${jobId} is missing tour_date_id`);
    }
    searchCriteria.tour_date_id = job.tour_date_id;
  } else {
    searchCriteria.job_id = jobId;
  }

  // Check if work_orders folder exists
  const { data: folders, error: foldersError } = await supabase
    .from('flex_folders')
    .select('element_id, department')
    .match(searchCriteria);

  if (foldersError) throw foldersError;

  let parentFolder = (folders || []).find((f) => (f as any)?.department === 'personnel') || (folders?.[0] as any);

  // Self-healing: Create work_orders folder if missing
  if (!parentFolder?.element_id) {
    console.log(`[FlexWorkOrders] No work_orders folder found for job ${jobId}, creating it now...`);
    
    // Find the personnel department folder as parent
    // For tourdate jobs, the personnel folder has folder_type: 'tourdate'
    // For other jobs, it has folder_type: 'department'
    const personnelFolderType = job.job_type === 'tourdate' ? 'tourdate' : 'department';
    
    const personnelSearchCriteria: any = {
      folder_type: personnelFolderType,
      department: 'personnel'
    };
    
    if (job.job_type === 'tourdate') {
      personnelSearchCriteria.tour_date_id = job.tour_date_id;
    } else {
      personnelSearchCriteria.job_id = jobId;
    }
    
    const { data: personnelFolder, error: personnelError } = await supabase
      .from('flex_folders')
      .select('element_id')
      .match(personnelSearchCriteria)
      .maybeSingle();
    
    if (personnelError) throw personnelError;
    if (!personnelFolder?.element_id) {
      throw new Error(
        `Personnel folder not found for ${job.job_type === 'tourdate' ? 'tour_date_id' : 'job_id'}: ${job.job_type === 'tourdate' ? job.tour_date_id : jobId}. Please create folders first.`
      );
    }
    
    // Create the work orders subfolder in Flex
    const plannedStartDate = formatDate(job.start_time) ?? new Date().toISOString().slice(0, 10);
    const plannedEndDate = formatDate(job.end_time) ?? plannedStartDate;
    const workOrderPayload = {
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId: personnelFolder.element_id,
      open: true,
      locked: false,
      name: `Órdenes de Trabajo - ${job.title} [${plannedStartDate} – ${plannedEndDate}]`,
    };
    
    const flexResponse = await fetch(`${FLEX_API_BASE_URL}/element`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'X-Auth-Token': token,
        'apikey': token,
      },
      body: JSON.stringify(workOrderPayload),
    });
    
    if (!flexResponse.ok) {
      const errorData = await flexResponse.json().catch(() => null);
      throw new Error(`Failed to create work orders folder in Flex: ${errorData?.exceptionMessage || flexResponse.statusText}`);
    }
    
    const flexData = await flexResponse.json();
    const newElementId = flexData?.id || flexData?.elementId || flexData?.data?.id;
    
    if (!newElementId) {
      throw new Error('Flex API created folder but returned no element ID');
    }
    
    // Save to flex_folders table
    const insertData: any = {
      parent_id: personnelFolder.element_id,
      element_id: newElementId,
      department: 'personnel',
      folder_type: 'work_orders',
    };
    
    if (job.job_type === 'tourdate') {
      insertData.tour_date_id = job.tour_date_id;
    } else {
      insertData.job_id = jobId;
    }
    
    const { data: insertedFolder, error: insertError } = await supabase
      .from('flex_folders')
      .insert(insertData)
      .select('element_id, department')
      .single();
    
    if (insertError) throw insertError;
    
    parentFolder = insertedFolder;
    console.log(`[FlexWorkOrders] Created work_orders folder: ${newElementId}`);
  }

  const timesheetQuery = supabase
    .from('timesheets')
    .select(
      `job_id, technician_id, date,
       profile:profiles!timesheets_technician_id_fkey(first_name, last_name, flex_resource_id, department)`
    )
    .eq('job_id', jobId)
    .eq('is_schedule_only', false);

  if (job.job_type === 'tourdate') {
    const jobDate = formatDate(job.start_time);
    if (jobDate) {
      timesheetQuery.eq('date', jobDate);
    }
  }

  const { data: timesheetRows, error: timesheetError } = await timesheetQuery;

  if (timesheetError) throw timesheetError;

  const timesheetTechnicians = Array.from(
    new Set(((timesheetRows as TimesheetCrewRow[] | null | undefined) || []).map((row) => row?.technician_id).filter(Boolean))
  ) as string[];

  if (timesheetTechnicians.length === 0) {
    return { created, skipped, errors };
  }

  const timesheetProfiles = new Map<string, TimesheetCrewRow['profile']>();
  (timesheetRows as TimesheetCrewRow[] | null | undefined)?.forEach((row) => {
    if (!row?.technician_id) return;
    const normalized = normalizeProfileRow(row.profile);
    if (normalized) {
      timesheetProfiles.set(row.technician_id, normalized);
    }
  });

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('job_assignments')
    .select(
      `technician_id, sound_role, lights_role, video_role, status,
       profiles!job_assignments_technician_id_fkey(first_name, last_name, flex_resource_id, department)`
    )
    .eq('job_id', jobId)
    .in('technician_id', timesheetTechnicians);

  if (assignmentError) throw assignmentError;

  const assignmentsByTechnician = new Map<string, AssignmentRow>();
  (assignmentRows as AssignmentRow[] | null | undefined)?.forEach((row) => {
    if (row?.technician_id && !assignmentsByTechnician.has(row.technician_id)) {
      assignmentsByTechnician.set(row.technician_id, row);
    }
  });

  let extrasRows: ExtraRow[] = [];
  if (timesheetTechnicians.length > 0) {
    const extrasQuery = supabase
      .from('job_rate_extras')
      .select('technician_id, extra_type, quantity, status')
      .eq('job_id', jobId)
      .in('technician_id', timesheetTechnicians);

    const { data: extras, error: extrasError } = await extrasQuery;
    if (extrasError) throw extrasError;
    extrasRows = (extras as ExtraRow[] | null | undefined) ?? [];
  }

  const extrasByTechnician = new Map<string, ExtraRow[]>();
  extrasRows.forEach((row) => {
    if (!row || row.quantity <= 0) return;
    if (row.status && row.status !== 'approved') return;
    const list = extrasByTechnician.get(row.technician_id) || [];
    list.push(row);
    extrasByTechnician.set(row.technician_id, list);
  });

  const { data: existingRows, error: existingError } = await supabase
    .from('flex_work_orders')
    .select('technician_id, flex_document_id')
    .eq('job_id', jobId);

  if (existingError) throw existingError;
  const existingMap = new Map<string, string>((existingRows || []).map((row) => [row.technician_id, row.flex_document_id]));

  for (const technicianId of timesheetTechnicians) {
    if (!technicianId) continue;
    const assignment = assignmentsByTechnician.get(technicianId);
    if (!assignment) {
      errors.push(`Técnico ${technicianId} no tiene job_assignment asociado, se omite la orden de trabajo.`);
      skipped += 1;
      continue;
    }
    if (assignment.status === 'declined') {
      skipped += 1;
      continue;
    }
    if (existingMap.has(technicianId)) {
      skipped += 1;
      continue;
    }

    const profileFallback =
      normalizeProfileRow(assignment.profiles) || timesheetProfiles.get(technicianId) || null;
    const flexResourceId = (profileFallback as any)?.flex_resource_id || null;
    if (!flexResourceId) {
      errors.push(`Técnico ${technicianId} no tiene Flex Resource ID, se omite la orden de trabajo.`);
      skipped += 1;
      continue;
    }

    try {
      const technicianName = technicianDisplayName(profileFallback || undefined);
      const { documentId, raw: createdRaw } = await createWorkOrderElement({
        parentElementId: parentFolder.element_id,
        job,
        technicianName,
        vendorId: flexResourceId,
        token,
      });
      let createdNumber: string | null = (createdRaw && (createdRaw.documentNumber || createdRaw.elementNumber || createdRaw.number)) || null;
      if (!createdNumber) {
        createdNumber = await fetchDocumentNumber(documentId, token);
      }

      // Build role line items for SOUND and LIGHTS only (skip VIDEO)
      const roleEntries: Array<{ dept: 'sound' | 'lights'; role: string }> = [];
      if (assignment.sound_role) roleEntries.push({ dept: 'sound', role: assignment.sound_role });
      if (assignment.lights_role) roleEntries.push({ dept: 'lights', role: assignment.lights_role });

      for (const r of roleEntries) {
        const laborResourceId = resourceIdForRole(r.dept, r.role);
        if (!laborResourceId) continue;
        const roleQty = (job.job_type && (job.job_type === 'single' || job.job_type === 'festival')) ? 3 : 1;
        const pricingModelId = (job.job_type && (job.job_type === 'tour' || job.job_type === 'tourdate'))
          ? PRICING_MODEL_DIA_TOUR_ID
          : PRICING_MODEL_BASE_2025_ID;
        const lineItemId = await addResourceLineItem({
          documentId,
          parentElementId: parentFolder.element_id,
          resourceId: laborResourceId,
          quantity: roleQty,
          token,
          managedResourceLineItemType: 'service-offering',
        });
        if (!lineItemId) {
          errors.push(`No se pudo añadir el line item de ${r.dept} (${r.role}) para el técnico ${technicianId}.`);
        }
        // Apply pricing model to main role line and set quantities
        if (lineItemId) {
          await setLineItemPricingModel({ documentId, lineItemId, pricingModelId, token });
          // Update both quantity and timeQty via row-data and bulk for reliability
          await setLineItemQuantityRow({ documentId, lineItemId, quantity: roleQty, token });
          await setLineItemQuantityBulk({ documentId, lineItemId, quantity: roleQty, token });
          await setLineItemTimeQty({ documentId, lineItemId, timeQty: roleQty, token });
          await setLineItemTimeQtyBulk({ documentId, lineItemId, timeQty: roleQty, token });
        }
        // For single/festival jobs with overtime, add child lines under SOUND and LIGHTS roles
        if (lineItemId && job.job_type && (job.job_type === 'single' || job.job_type === 'festival') && (r.dept === 'sound' || r.dept === 'lights')) {
          // Horas 11-12
          const child1 = await addResourceLineItem({
            documentId,
            parentElementId: parentFolder.element_id,
            resourceId: '14b84b51-2a96-4afd-a384-f86f18f039da',
            quantity: 0,
            token,
            managedResourceLineItemType: 'service-offering',
            parentLineItemId: lineItemId,
          });
          // Horas 13+ R
          const child2 = await addResourceLineItem({
            documentId,
            parentElementId: parentFolder.element_id,
            resourceId: '7d5eaf16-4499-45e1-b705-b5f1513ea71f',
            quantity: 0,
            token,
            managedResourceLineItemType: 'service-offering',
            parentLineItemId: lineItemId,
          });
          if (child1) {
            await setLineItemPricingModel({ documentId, lineItemId: child1, pricingModelId, token });
          }
          if (child2) {
            await setLineItemPricingModel({ documentId, lineItemId: child2, pricingModelId, token });
          }
        }
      }

      // Add extras as line items (approved only)
      const technicianExtras = extrasByTechnician.get(technicianId) || [];
      if (technicianExtras.length > 0) {
        let travelHalf = 0;
        let travelFull = 0;
        let dayOff = 0;
        for (const ex of technicianExtras) {
          if (ex.extra_type === 'travel_half') travelHalf += ex.quantity;
          if (ex.extra_type === 'travel_full') travelFull += ex.quantity;
          if (ex.extra_type === 'day_off') dayOff += ex.quantity;
        }
        const transitUnits = (travelHalf * 1) + (travelFull * 2);
        if (transitUnits > 0) {
          await addResourceLineItem({
            documentId,
            parentElementId: parentFolder.element_id,
            resourceId: EXTRA_RESOURCE_IDS.transit,
            quantity: transitUnits,
            token,
            managedResourceLineItemType: 'service-offering',
          });
        }
        if (dayOff > 0) {
          await addResourceLineItem({
            documentId,
            parentElementId: parentFolder.element_id,
            resourceId: EXTRA_RESOURCE_IDS.dayOff,
            quantity: dayOff,
            token,
            managedResourceLineItemType: 'service-offering',
          });
        }
      }

      const insertPayload: any = {
        job_id: jobId,
        technician_id: technicianId,
        // Store under both legacy and current column names for compatibility
        flex_document_id: documentId,
        flex_element_id: documentId,
        folder_element_id: (parentFolder as any)?.element_id,
        flex_vendor_id: flexResourceId,
      };
      const { error: insertError } = await supabase
        .from('flex_work_orders')
        .insert({ ...insertPayload, lpo_number: createdNumber });

      if (insertError) {
        throw insertError;
      }

      existingMap.set(technicianId, documentId);
      created += 1;
    } catch (err) {
      console.error('[FlexWorkOrders] Failed to create work order', err);
      errors.push(
        `Fallo al crear orden de trabajo para técnico ${technicianId}: ${(err as Error).message || 'Error desconocido'}`
      );
    }
  }

  return { created, skipped, errors };
}
