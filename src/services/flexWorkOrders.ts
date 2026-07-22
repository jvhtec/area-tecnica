import { supabase } from '@/integrations/supabase/client';
import { flexApiFetch } from '@/lib/flex-api-client';
import { FLEX_FOLDER_IDS } from '@/utils/flex-folders/constants';
import { resourceIdForRole, EXTRA_RESOURCE_IDS } from '@/utils/flex-labor-resources';
import { MADRID_TIMEZONE } from '@/utils/timezoneUtils';
import { formatFlexWorkOrderDate } from '@/services/flexWorkOrderDates';

import {
  CURRENCY_EUR_ID,
  PERSONNEL_RESPONSIBLE_ID,
  PRICING_MODEL_BASE_2025_ID,
  PRICING_MODEL_DIA_TOUR_ID,
  WORK_ORDER_DEFINITION_ID,
  technicianDisplayName,
} from './flex-work-orders/config';

async function createWorkOrderElement(options: {
  parentElementId: string;
  job: { id: string; title: string; start_time: string; end_time: string; location_id: string | null; timezone?: string | null };
  technicianName: string;
  vendorId: string;
}): Promise<{ documentId: string; raw: any }>
{
  const { parentElementId, job, technicianName, vendorId } = options;

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

  const response = await flexApiFetch('/element', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json<{ exceptionMessage?: string }>().catch((): null => null);
    const message = errorPayload?.exceptionMessage || response.statusText || 'Failed to create work order';
    throw new Error(message);
  }

  const raw: Record<string, any> = await response
    .json<Record<string, any>>()
    .catch((): Record<string, any> => ({}));
  const documentId =
    raw?.id || raw?.elementId || raw?.data?.id || raw?.data?.elementId || raw?.element?.id || null;
  const documentNumber = raw?.documentNumber || raw?.elementNumber || raw?.number || raw?.data?.documentNumber || null;

  if (!documentId) {
    throw new Error('Flex work order creation succeeded without returning an element id');
  }

  return { documentId, raw: { ...raw, documentNumber } };
}

async function fetchDocumentNumber(documentId: string): Promise<string | null> {
  const url = `/element/${encodeURIComponent(documentId)}/key-info/`;
  try {
    const res = await flexApiFetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    const j = await res.json().catch((): null => null) as any;
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
  managedResourceLineItemType?: string;
  parentLineItemId?: string;
}): Promise<string | null> {
  const { documentId, parentElementId, resourceId, quantity = 1, managedResourceLineItemType = 'service-offering', parentLineItemId } = options;
  const baseUrl = `/financial-document-line-item/${encodeURIComponent(documentId)}/add-resource/${encodeURIComponent(resourceId)}`;
  const query = new URLSearchParams({
    resourceParentId: parentElementId,
    managedResourceLineItemType,
    quantity: String(quantity),
  });

  const tryRequest = async (init: RequestInit): Promise<any | null> => {
    try {
      const res = await flexApiFetch(`${baseUrl}?${query.toString()}`, init);
      if (!res.ok) return null;
      return await res.json().catch((): null => null);
    } catch (err) {
      console.error('[FlexWorkOrders] Failed to add resource line item', err);
      return null;
    }
  };

  const headers = { accept: '*/*' } as Record<string, string>;
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
}): Promise<boolean> {
  const { documentId, lineItemId, pickupDate, returnDate } = options;
  const url = `/financial-document-line-item/${encodeURIComponent(documentId)}/bulk-update`;
  try {
    const res = await flexApiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
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
}): Promise<boolean> {
  const { documentId, lineItemId, pricingModelId } = options;
  const rowDataUrl = `/financial-document-line-item/${encodeURIComponent(documentId)}/row-data/`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
    } as Record<string,string>;
    // First try dedicated update endpoint with camelCase field (per working example)
    const ok = await updateLineItemField({ documentId, lineItemId, fieldType: 'pricingModel', payloadValue: pricingModelId });
    if (ok) return true;

    // Fallback to row-data camelCase
    let res = await flexApiFetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'pricingModel', payloadValue: pricingModelId }),
    });
    if (res.ok) return true;

    // Fallback to kebab-case on row-data
    res = await flexApiFetch(rowDataUrl, {
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
}): Promise<boolean> {
  const { documentId, lineItemId, timeQty } = options;
  const rowDataUrl = `/financial-document-line-item/${encodeURIComponent(documentId)}/row-data/`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
    } as Record<string,string>;
    // Try dedicated update endpoint first (as per working payload)
    const ok = await updateLineItemField({ documentId, lineItemId, fieldType: 'timeQty', payloadValue: timeQty });
    if (ok) return true;
    // Try canonical camelCase key first (as seen in Flex payloads)
    let res = await flexApiFetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'timeQty', payloadValue: timeQty }),
    });
    if (res.ok) return true;

    // Fallback to kebab-case variant some environments expect
    res = await flexApiFetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'time-qty', payloadValue: timeQty }),
    });
    if (res.ok) return true;

    // Last fallback: send as string payload
    res = await flexApiFetch(rowDataUrl, {
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
}): Promise<boolean> {
  const { documentId, lineItemId, timeQty } = options;
  const url = `/financial-document-line-item/${encodeURIComponent(documentId)}/bulk-update`;
  try {
    const res = await flexApiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
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
}): Promise<boolean> {
  const { documentId, lineItemId, fieldType, payloadValue } = options;
  const url = `/financial-document-line-item/${encodeURIComponent(documentId)}/update`;
  try {
    const res = await flexApiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
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
}): Promise<boolean> {
  const { documentId, lineItemId, quantity } = options;
  const rowDataUrl = `/financial-document-line-item/${encodeURIComponent(documentId)}/row-data/`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
    } as Record<string,string>;
    // Try dedicated update endpoint first
    const ok = await updateLineItemField({ documentId, lineItemId, fieldType: 'quantity', payloadValue: quantity });
    if (ok) return true;
    let res = await flexApiFetch(rowDataUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lineItemId, fieldType: 'quantity', payloadValue: quantity }),
    });
    if (res.ok) return true;
    res = await flexApiFetch(rowDataUrl, {
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
}): Promise<boolean> {
  const { documentId, lineItemId, quantity } = options;
  const url = `/financial-document-line-item/${encodeURIComponent(documentId)}/bulk-update`;
  try {
    const res = await flexApiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
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
}): Promise<void> {
  const { documentId, note } = options;
  const url = `/financial-document-line-item/${encodeURIComponent(documentId)}/add-note`;

  const tryJson = async () => {
    try {
      const res = await flexApiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
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
    const res = await flexApiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        accept: '*/*',
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

interface FlexFolderLookupRow {
  element_id: string;
  department?: string | null;
  job_id?: string | null;
  tour_date_id?: string | null;
  folder_type?: string | null;
  created_at?: string | null;
}

function pickPreferredTourdateFolder<T extends { job_id?: string | null; tour_date_id?: string | null; folder_type?: string | null }>(
  rows: T[] | null | undefined,
  jobId: string,
  tourDateId: string,
  preferredFolderType?: string
): T | null {
  if (!rows?.length) return null;

  const typedRows = preferredFolderType
    ? rows.filter((row) => row.folder_type === preferredFolderType)
    : rows;
  const pool = typedRows.length > 0 ? typedRows : rows;

  return (
    pool.find((row) => row.job_id === jobId && row.tour_date_id === tourDateId) ??
    pool.find((row) => row.job_id === jobId) ??
    pool.find((row) => row.tour_date_id === tourDateId) ??
    pool[0] ??
    null
  );
}

export async function syncFlexWorkOrdersForJob(jobId: string): Promise<FlexWorkOrderSyncResult> {
  if (!jobId) {
    throw new Error('Job id is required to sync Flex work orders');
  }

  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  const [{ data: job, error: jobError }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, start_time, end_time, timezone, location_id, job_type, tour_date_id')
      .eq('id', jobId)
      .maybeSingle(),
  ]);

  if (jobError) throw jobError;
  if (!job) throw new Error('Job not found');

  const isTourdateJob = job.job_type === 'tourdate';
  const tourDateId = job.tour_date_id;

  if (isTourdateJob && !tourDateId) {
      throw new Error(`Tourdate job ${jobId} is missing tour_date_id`);
  }

  // Check if work_orders folder exists
  let workOrdersQuery = supabase
    .from('flex_folders')
    .select('element_id, department, job_id, tour_date_id, folder_type, created_at')
    .eq('folder_type', 'work_orders')
    .eq('department', 'personnel');

  if (isTourdateJob) {
    workOrdersQuery = workOrdersQuery.or(`job_id.eq.${jobId},tour_date_id.eq.${tourDateId}`);
  } else {
    workOrdersQuery = workOrdersQuery.eq('job_id', jobId);
  }

  const { data: folders, error: foldersError } = await workOrdersQuery.order('created_at', { ascending: false });

  if (foldersError) throw foldersError;

  let parentFolder: FlexFolderLookupRow | null = isTourdateJob
    ? pickPreferredTourdateFolder((folders || []) as FlexFolderLookupRow[], jobId, tourDateId!, 'work_orders')
    : ((folders?.[0] as FlexFolderLookupRow | undefined) || null);

  // Self-healing: Create work_orders folder if missing
  if (!parentFolder?.element_id) {
    console.log(`[FlexWorkOrders] No work_orders folder found for job ${jobId}, creating it now...`);
    
    let personnelFolder: FlexFolderLookupRow | null = null;

    if (isTourdateJob) {
      // Tour-date folders are stored with mixed keys in legacy/current flows.
      const { data: personnelFolders, error: personnelError } = await supabase
        .from('flex_folders')
        .select('element_id, job_id, tour_date_id, folder_type, created_at')
        .eq('department', 'personnel')
        .in('folder_type', ['tourdate', 'department'])
        .or(`job_id.eq.${jobId},tour_date_id.eq.${tourDateId}`)
        .order('created_at', { ascending: false });

      if (personnelError) throw personnelError;

      personnelFolder =
        pickPreferredTourdateFolder(personnelFolders as FlexFolderLookupRow[] | null, jobId, tourDateId!, 'tourdate') ||
        pickPreferredTourdateFolder(personnelFolders as FlexFolderLookupRow[] | null, jobId, tourDateId!);
    } else {
      const { data: personnelFolders, error: personnelError } = await supabase
        .from('flex_folders')
        .select('element_id, created_at')
        .eq('department', 'personnel')
        .eq('folder_type', 'department')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (personnelError) throw personnelError;
      personnelFolder = ((personnelFolders?.[0] as FlexFolderLookupRow | undefined) || null);
    }
    
    if (!personnelFolder?.element_id) {
      throw new Error(
        isTourdateJob
          ? `Personnel folder not found for job_id ${jobId} / tour_date_id ${tourDateId}. Please create folders first.`
          : `Personnel folder not found for job_id ${jobId}. Please create folders first.`
      );
    }
    
    // Create the work orders subfolder in Flex
    const timezone = job.timezone || MADRID_TIMEZONE;
    const plannedStartDate = formatFlexWorkOrderDate(job.start_time, timezone) ?? formatFlexWorkOrderDate(new Date().toISOString(), timezone)!;
    const plannedEndDate = formatFlexWorkOrderDate(job.end_time, timezone) ?? plannedStartDate;
    const workOrderPayload = {
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId: personnelFolder.element_id,
      open: true,
      locked: false,
      name: `Órdenes de Trabajo - ${job.title} [${plannedStartDate} – ${plannedEndDate}]`,
    };
    
    const flexResponse = await flexApiFetch('/element', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(workOrderPayload),
    });
    
    if (!flexResponse.ok) {
      const errorData = await flexResponse.json<{ exceptionMessage?: string }>().catch((): null => null);
      throw new Error(`Failed to create work orders folder in Flex: ${errorData?.exceptionMessage || flexResponse.statusText}`);
    }
    
    const flexData = await flexResponse.json<Record<string, any>>();
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
      job_id: jobId,
    };
    
    if (isTourdateJob) {
      insertData.tour_date_id = tourDateId;
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

  const { data: assignments, error: assignmentError } = await supabase
    .from('job_assignments')
    .select(
      `technician_id, sound_role, lights_role, video_role, status,
       profiles!job_assignments_technician_id_fkey(first_name, last_name, flex_resource_id, department)`
    )
    .eq('job_id', jobId);

  if (assignmentError) throw assignmentError;

  const { data: extras, error: extrasError } = await supabase
    .from('job_rate_extras')
    .select('technician_id, extra_type, quantity, status')
    .eq('job_id', jobId);

  if (extrasError) throw extrasError;

  const extrasByTechnician = new Map<string, ExtraRow[]>();
  (extras as ExtraRow[] | null | undefined)?.forEach((row) => {
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

  for (const assignment of (assignments as AssignmentRow[] | null | undefined) || []) {
    const technicianId = assignment.technician_id;
    if (!technicianId) continue;
    if (assignment.status === 'declined') {
      skipped += 1;
      continue;
    }
    if (existingMap.has(technicianId)) {
      skipped += 1;
      continue;
    }

    const flexResourceId = assignment.profiles?.flex_resource_id || null;
    if (!flexResourceId) {
      errors.push(`Técnico ${technicianId} no tiene Flex Resource ID, se omite la orden de trabajo.`);
      skipped += 1;
      continue;
    }

    try {
      const technicianName = technicianDisplayName(assignment.profiles || undefined);
      const { documentId, raw: createdRaw } = await createWorkOrderElement({
        parentElementId: parentFolder.element_id,
        job,
        technicianName,
        vendorId: flexResourceId,
      });
      let createdNumber: string | null = (createdRaw && (createdRaw.documentNumber || createdRaw.elementNumber || createdRaw.number)) || null;
      if (!createdNumber) {
        createdNumber = await fetchDocumentNumber(documentId);
      }

      // Build role line items for SOUND and LIGHTS only (skip VIDEO)
      const roleEntries: Array<{ dept: 'sound' | 'lights'; role: string }> = [];
      if (assignment.sound_role) roleEntries.push({ dept: 'sound', role: assignment.sound_role });
      if (assignment.lights_role) roleEntries.push({ dept: 'lights', role: assignment.lights_role });

      for (const r of roleEntries) {
        const laborResourceId = resourceIdForRole(r.dept, r.role);
        if (!laborResourceId) continue;
        const roleQty = (job.job_type && (job.job_type === 'single' || job.job_type === 'festival' || job.job_type === 'ciclo')) ? 3 : 1;
        const pricingModelId = (job.job_type && (job.job_type === 'tour' || job.job_type === 'tourdate'))
          ? PRICING_MODEL_DIA_TOUR_ID
          : PRICING_MODEL_BASE_2025_ID;
        const lineItemId = await addResourceLineItem({
          documentId,
          parentElementId: parentFolder.element_id,
          resourceId: laborResourceId,
          quantity: roleQty,
          managedResourceLineItemType: 'service-offering',
        });
        if (!lineItemId) {
          errors.push(`No se pudo añadir el line item de ${r.dept} (${r.role}) para el técnico ${technicianId}.`);
        }
        // Apply pricing model to main role line and set quantities
        if (lineItemId) {
          await setLineItemPricingModel({ documentId, lineItemId, pricingModelId });
          // Update both quantity and timeQty via row-data and bulk for reliability
          await setLineItemQuantityRow({ documentId, lineItemId, quantity: roleQty });
          await setLineItemQuantityBulk({ documentId, lineItemId, quantity: roleQty });
          await setLineItemTimeQty({ documentId, lineItemId, timeQty: roleQty });
          await setLineItemTimeQtyBulk({ documentId, lineItemId, timeQty: roleQty });
        }
        // For single/festival jobs with overtime, add child lines under SOUND and LIGHTS roles
        if (lineItemId && job.job_type && (job.job_type === 'single' || job.job_type === 'festival' || job.job_type === 'ciclo') && (r.dept === 'sound' || r.dept === 'lights')) {
          // Horas 11-12
          const child1 = await addResourceLineItem({
            documentId,
            parentElementId: parentFolder.element_id,
            resourceId: '14b84b51-2a96-4afd-a384-f86f18f039da',
            quantity: 0,
            managedResourceLineItemType: 'service-offering',
            parentLineItemId: lineItemId,
          });
          // Horas 13+ R
          const child2 = await addResourceLineItem({
            documentId,
            parentElementId: parentFolder.element_id,
            resourceId: '7d5eaf16-4499-45e1-b705-b5f1513ea71f',
            quantity: 0,
            managedResourceLineItemType: 'service-offering',
            parentLineItemId: lineItemId,
          });
          if (child1) {
            await setLineItemPricingModel({ documentId, lineItemId: child1, pricingModelId });
          }
          if (child2) {
            await setLineItemPricingModel({ documentId, lineItemId: child2, pricingModelId });
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
            managedResourceLineItemType: 'service-offering',
          });
        }
        if (dayOff > 0) {
          await addResourceLineItem({
            documentId,
            parentElementId: parentFolder.element_id,
            resourceId: EXTRA_RESOURCE_IDS.dayOff,
            quantity: dayOff,
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
