import { supabase } from '@/integrations/supabase/client';
import { FLEX_API_BASE_URL } from '@/lib/api-config';
import { FLEX_FOLDER_IDS, RESPONSIBLE_PERSON_IDS } from '@/utils/flex-folders/constants';
import { labelForCode } from '@/types/roles';

const WORK_ORDER_DEFINITION_ID = FLEX_FOLDER_IDS.ordenTrabajo;
const DEFAULT_LOCATION_ID = FLEX_FOLDER_IDS.location;
const PERSONNEL_RESPONSIBLE_ID = RESPONSIBLE_PERSON_IDS.personnel;

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
    documentNumber: `${job.title?.slice(0, 24) || 'OT'}-${technicianName.slice(0, 12)}`,
    plannedStartDate,
    plannedEndDate,
    locationId: job.location_id || DEFAULT_LOCATION_ID,
    personResponsibleId: PERSONNEL_RESPONSIBLE_ID,
    vendorId,
  };

  const response = await fetch(`${FLEX_API_BASE_URL}/element`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'X-Auth-Token': token,
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

  if (!documentId) {
    throw new Error('Flex work order creation succeeded without returning an element id');
  }

  return { documentId, raw };
}

async function addResourceLineItem(options: {
  documentId: string;
  parentElementId: string;
  resourceId: string;
  quantity?: number;
  token: string;
}): Promise<string | null> {
  const { documentId, parentElementId, resourceId, quantity = 1, token } = options;
  const baseUrl = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/add-resource/${encodeURIComponent(resourceId)}`;
  const query = new URLSearchParams({
    resourceParentId: parentElementId,
    managedResourceLineItemType: 'contact',
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

  const headers = { accept: '*/*', 'X-Auth-Token': token } as Record<string, string>;
  let payload = await tryRequest({ method: 'POST', headers });

  if (!payload) {
    const fallbackHeaders = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    };
    const form = new URLSearchParams({
      resourceParentId: parentElementId,
      managedResourceLineItemType: 'contact',
      quantity: String(quantity),
      parentLineItemId: '',
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
      .select('id, title, start_time, end_time, location_id, job_type')
      .eq('id', jobId)
      .maybeSingle(),
  ]);

  if (jobError) throw jobError;
  if (!job) throw new Error('Job not found');

  let { data: folders, error: foldersError } = await supabase
    .from('flex_folders')
    .select('element_id, department')
    .eq('job_id', jobId)
    .eq('folder_type', 'work_orders');

  if (foldersError) throw foldersError;

  let parentFolder = (folders || []).find((f) => (f as any)?.department === 'personnel') || (folders?.[0] as any);

  // Self-healing: Create work_orders folder if missing
  if (!parentFolder?.element_id) {
    console.log(`[FlexWorkOrders] No work_orders folder found for job ${jobId}, creating it now...`);
    
    // Find the personnel department folder as parent
    // For tourdate jobs, the personnel folder has folder_type: 'tourdate'
    // For other jobs, it has folder_type: 'department'
    const personnelFolderType = job.job_type === 'tourdate' ? 'tourdate' : 'department';
    
    const { data: personnelFolder, error: personnelError } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('folder_type', personnelFolderType)
      .eq('department', 'personnel')
      .maybeSingle();
    
    if (personnelError) throw personnelError;
    if (!personnelFolder?.element_id) {
      throw new Error('No personnel department folder found - cannot create work orders folder');
    }
    
    // Create the work orders subfolder in Flex
    const workOrderPayload = {
      definitionId: FLEX_FOLDER_IDS.ordenTrabajo,
      parentElementId: personnelFolder.element_id,
      open: true,
      locked: false,
      name: `Órdenes de Trabajo - ${job.title}`,
      documentNumber: `${job.title?.slice(0, 20) || 'OT'}-Orders`,
    };
    
    const flexResponse = await fetch(`${FLEX_API_BASE_URL}/element`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'X-Auth-Token': token,
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
    const { data: insertedFolder, error: insertError } = await supabase
      .from('flex_folders')
      .insert({
        job_id: jobId,
        parent_id: personnelFolder.element_id,
        element_id: newElementId,
        department: 'personnel',
        folder_type: 'work_orders',
      })
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
      const { documentId } = await createWorkOrderElement({
        parentElementId: parentFolder.element_id,
        job,
        technicianName,
        vendorId: flexResourceId,
        token,
      });

      const roles: Array<{ role: string; department: string | null }> = [];
      if (assignment.sound_role) {
        roles.push({ role: assignment.sound_role, department: 'sound' });
      }
      if (assignment.lights_role) {
        roles.push({ role: assignment.lights_role, department: 'lights' });
      }
      if (assignment.video_role) {
        roles.push({ role: assignment.video_role, department: 'video' });
      }

      for (const roleEntry of roles) {
        const lineItemId = await addResourceLineItem({
          documentId,
          parentElementId: parentFolder.element_id,
          resourceId: flexResourceId,
          quantity: 1,
          token,
        });

        if (!lineItemId) {
          errors.push(
            `No se pudo añadir el line item para la función ${roleEntry.role} del técnico ${technicianId}.`
          );
        }
      }

      const technicianExtras = extrasByTechnician.get(technicianId) || [];
      if (technicianExtras.length > 0) {
        const summary = technicianExtras
          .map((extra) => `${extra.extra_type} x${extra.quantity}`)
          .join(' / ');
        const label = roles.length ? labelForCode(roles[0].role) || roles[0].role : technicianName;
        await addExtraNoteLineItem({
          documentId,
          note: `Extras (${label}): ${summary}`,
          token,
        });
      }

      const { error: insertError } = await supabase
        .from('flex_work_orders')
        .insert({
          job_id: jobId,
          technician_id: technicianId,
          flex_document_id: documentId,
        });

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
