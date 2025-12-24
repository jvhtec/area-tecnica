import { supabase } from '@/integrations/supabase/client';
import { FLEX_API_BASE_URL } from '@/lib/api-config';
import { FLEX_FOLDER_IDS, DEPARTMENT_IDS, RESPONSIBLE_PERSON_IDS, DEPARTMENT_SUFFIXES } from '@/utils/flex-folders/constants';
import { createFlexFolder } from '@/utils/flex-folders/api';
import { FlexFolderPayload } from '@/utils/flex-folders/types';
import type { EquipmentItem, PushResult } from './flexPullsheets';
import { pushEquipmentToPullsheet } from './flexPullsheets';
import type { PresetSubsystem } from '@/types/equipment';

let cachedFlexToken: string | null = null;

/**
 * Gets the Flex authentication token from Supabase secrets
 */
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

/**
 * Format date string for Flex API (ISO format with milliseconds)
 */
function formatDateForFlex(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString().split('.')[0] + '.000Z';
  } catch {
    return undefined;
  }
}

const SUBSYSTEM_TO_FLEX_CATEGORY: Record<PresetSubsystem, string> = {
  mains: 'pa_mains',
  outs: 'pa_outfill',
  subs: 'pa_subs',
  fronts: 'pa_frontfill',
  delays: 'pa_delays',
  other: 'pa_mains',
  amplification: 'pa_amp',
};

/**
 * Extract equipment items from festival gear setup JSON fields
 */
function extractGearItems(
  gearSetup: any,
  department: 'sound' | 'lights'
): EquipmentItem[] {
  if (!gearSetup) return [];

  const items: EquipmentItem[] = [];

  // Fields to extract based on department
  const soundFields = ['foh_consoles', 'mon_consoles', 'wireless_systems', 'iem_systems', 'wired_mics'];
  const lightsFields = ['lighting_consoles', 'dimmers', 'fixtures'];
  const fields = department === 'sound' ? soundFields : lightsFields;

  for (const field of fields) {
    const fieldData = gearSetup[field];
    if (!fieldData) continue;

    try {
      const parsed = typeof fieldData === 'string' ? JSON.parse(fieldData) : fieldData;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.resource_id && item.quantity) {
            items.push({
              resourceId: item.resource_id,
              quantity: item.quantity,
              name: item.name || item.model || 'Unknown',
              category: mapGearFieldToCategory(field),
            });
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to parse gear field ${field}:`, e);
    }
  }

  return items;
}

/**
 * Map gear setup field names to flex categories
 */
function mapGearFieldToCategory(fieldName: string): string {
  const mapping: Record<string, string> = {
    foh_consoles: 'foh_console',
    mon_consoles: 'mon_console',
    wireless_systems: 'wireless',
    iem_systems: 'iem',
    wired_mics: 'wired_mics',
    lighting_consoles: 'lights_console',
    dimmers: 'lights_dimmer',
    fixtures: 'lights_fixture',
  };
  return mapping[fieldName] || 'uncategorized';
}

/**
 * Extract equipment items from presets
 */
async function extractPresetItems(
  jobId: string,
  department: 'sound' | 'lights',
  dateFilter?: string
): Promise<EquipmentItem[]> {
  let query = supabase
    .from('day_preset_assignments')
    .select(`
      *,
      preset:presets!inner (
        *,
        items:preset_items (
          *,
          equipment:equipment (
            resource_id,
            name,
            category
          )
        )
      )
    `)
    .eq('source', 'job')
    .eq('source_id', jobId)
    .eq('preset.department', department);

  if (dateFilter) {
    query = query.eq('date', dateFilter);
  }

  const { data: presetAssignments, error } = await query;

  if (error) {
    console.error('Failed to fetch preset assignments:', error);
    return [];
  }

  if (!presetAssignments) return [];

  const items: EquipmentItem[] = [];

  for (const assignment of presetAssignments) {
    const preset = assignment.preset as any;
    if (!preset?.items) continue;

    for (const presetItem of preset.items) {
      const equipment = presetItem.equipment;
      if (!equipment?.resource_id) continue;

      // Resolve category from subsystem or equipment category
      let category = 'uncategorized';
      if (presetItem.subsystem) {
        category = SUBSYSTEM_TO_FLEX_CATEGORY[presetItem.subsystem as PresetSubsystem];
      } else if (equipment.category) {
        category = equipment.category;
      }

      items.push({
        resourceId: equipment.resource_id,
        quantity: presetItem.quantity || 1,
        name: equipment.name || 'Unknown',
        category,
        subsystem: presetItem.subsystem,
      });
    }
  }

  return items;
}

/**
 * Merge and deduplicate equipment items by resourceId
 */
function mergeEquipmentItems(items: EquipmentItem[]): EquipmentItem[] {
  const merged = new Map<string, EquipmentItem>();

  for (const item of items) {
    const key = `${item.resourceId}:${item.category || 'uncategorized'}`;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      merged.set(key, { ...item });
    }
  }

  return Array.from(merged.values());
}

/**
 * Get all equipment items for a festival stage
 */
export async function getStagePresupuestoItems(
  jobId: string,
  stageNumber: number,
  department: 'sound' | 'lights',
  dateFilter?: string
): Promise<EquipmentItem[]> {
  // 1. Get stage gear setup
  const { data: globalGear, error: globalError } = await supabase
    .from('festival_gear_setups')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (globalError) {
    console.error('Failed to fetch global gear setup:', globalError);
    throw new Error('Failed to fetch gear setup');
  }

  let gearSetup = globalGear;

  // Check for stage-specific overrides
  if (globalGear?.id) {
    const { data: stageGear } = await supabase
      .from('festival_stage_gear_setups')
      .select('*')
      .eq('gear_setup_id', globalGear.id)
      .eq('stage_number', stageNumber)
      .maybeSingle();

    if (stageGear) {
      gearSetup = stageGear;
    }
  }

  // 2. Extract gear items
  const gearItems = gearSetup ? extractGearItems(gearSetup, department) : [];

  // 3. Extract preset items
  const presetItems = await extractPresetItems(jobId, department, dateFilter);

  // 4. Merge and deduplicate
  const allItems = mergeEquipmentItems([...gearItems, ...presetItems]);

  console.log(`[FlexPresupuesto] Found ${gearItems.length} gear items + ${presetItems.length} preset items = ${allItems.length} total items`);

  return allItems;
}

/**
 * Get or create the comercial folder for a job
 */
async function ensureComercialFolder(jobId: string): Promise<{ element_id: string }> {
  // Check if comercial folder already exists
  const { data: existing } = await supabase
    .from('flex_folders')
    .select('element_id')
    .eq('job_id', jobId)
    .eq('folder_type', 'comercial')
    .maybeSingle();

  if (existing?.element_id) {
    return { element_id: existing.element_id };
  }

  // If not, we need to create it - but this should typically be done via flex folder creation
  throw new Error('Comercial folder not found. Please create Flex folders first.');
}

/**
 * Create a presupuesto document in the comercial folder
 */
async function createPresupuestoDocument(options: {
  jobId: string;
  comercialFolderId: string;
  department: 'sound' | 'lights';
  useExtrasFolder: boolean;
  customName?: string;
  stageNumber?: number;
}): Promise<string> {
  const { jobId, comercialFolderId, department, useExtrasFolder, customName, stageNumber } = options;

  // Get job details for naming
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('title, start_time, end_time')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error('Failed to fetch job details');
  }

  // Get comercial folder document number
  const { data: comercialFolder } = await supabase
    .from('flex_folders')
    .select('element_id')
    .eq('job_id', jobId)
    .eq('folder_type', 'comercial')
    .single();

  if (!comercialFolder) {
    throw new Error('Comercial folder not found');
  }

  // Fetch document number from Flex API
  const token = await getFlexAuthToken();
  const response = await fetch(`${FLEX_API_BASE_URL}/element/${comercialFolder.element_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
      'apikey': token,
    },
  });

  let documentNumber = '';
  if (response.ok) {
    const data = await response.json();
    documentNumber = data.documentNumber || '';
  }

  const deptLabel = department === 'sound' ? 'Sonido' : 'Luces';
  const deptSuffix = department === 'sound' ? 'SQT' : 'LQT';
  const jobTitle = job.title?.trim() || 'Unknown Job';
  const stageSuffix = stageNumber ? ` S${stageNumber}` : '';

  const formattedStartDate = formatDateForFlex(job.start_time);
  const formattedEndDate = formatDateForFlex(job.end_time);

  let presupuestoParentId = comercialFolderId;
  let presupuestoDocNumber = `${documentNumber}${deptSuffix}${stageSuffix}`;

  // Create extras folder if requested
  if (useExtrasFolder) {
    const extrasName = `Extras ${jobTitle}${stageNumber ? ` - Stage ${stageNumber}` : ''} - ${deptLabel}`;
    const extrasPayload: FlexFolderPayload = {
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId: comercialFolderId,
      name: extrasName,
      open: true,
      locked: false,
      plannedStartDate: formattedStartDate,
      plannedEndDate: formattedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS[department],
      documentNumber: presupuestoDocNumber,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
    };

    const extrasFolder = await createFlexFolder(extrasPayload);
    if (!extrasFolder.elementId) {
      throw new Error('Failed to create extras folder');
    }

    // Save extras folder to database
    await supabase.from('flex_folders').insert({
      job_id: jobId,
      parent_id: comercialFolderId,
      element_id: extrasFolder.elementId,
      department,
      folder_type: 'comercial_extras',
      stage_number: stageNumber,
    });

    presupuestoParentId = extrasFolder.elementId;
  }

  // Create presupuesto document
  const presupuestoName = customName
    ? customName
    : `${jobTitle}${stageNumber ? ` - Stage ${stageNumber}` : ''} - ${deptLabel} - Presupuesto`;

  const presupuestoPayload: FlexFolderPayload = {
    definitionId: FLEX_FOLDER_IDS.presupuesto,
    parentElementId: presupuestoParentId,
    name: presupuestoName,
    open: true,
    locked: false,
    plannedStartDate: formattedStartDate,
    plannedEndDate: formattedEndDate,
    locationId: FLEX_FOLDER_IDS.location,
    departmentId: DEPARTMENT_IDS[department],
    documentNumber: `${presupuestoDocNumber}PR01`,
    personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
  };

  const presupuestoResponse = await createFlexFolder(presupuestoPayload);
  if (!presupuestoResponse.elementId) {
    throw new Error('Failed to create presupuesto document');
  }

  // Save presupuesto to database
  await supabase.from('flex_folders').insert({
    job_id: jobId,
    parent_id: presupuestoParentId,
    element_id: presupuestoResponse.elementId,
    department,
    folder_type: 'comercial_presupuesto',
    stage_number: stageNumber,
  });

  console.log(`[FlexPresupuesto] Created presupuesto: ${presupuestoResponse.elementId}`);
  return presupuestoResponse.elementId;
}

/**
 * Create a presupuesto from festival stage gear and presets
 */
export async function createPresupuestoFromStage(options: {
  jobId: string;
  stageNumber: number;
  department: 'sound' | 'lights';
  useExtrasFolder?: boolean;
  customName?: string;
  dateFilter?: string;
}): Promise<{ presupuestoId: string; pushResult: PushResult }> {
  const {
    jobId,
    stageNumber,
    department,
    useExtrasFolder = false,
    customName,
    dateFilter,
  } = options;

  // 1. Get all items for this stage
  const items = await getStagePresupuestoItems(jobId, stageNumber, department, dateFilter);

  // Validation: Don't allow empty presupuesto
  if (items.length === 0) {
    throw new Error('No equipment items found for this stage and department. Cannot create empty presupuesto.');
  }

  // 2. Get comercial folder
  const comercialFolder = await ensureComercialFolder(jobId);

  // 3. Create presupuesto document
  const presupuestoId = await createPresupuestoDocument({
    jobId,
    comercialFolderId: comercialFolder.element_id,
    department,
    useExtrasFolder,
    customName,
    stageNumber,
  });

  // 4. Add line items to presupuesto (reuse pushEquipmentToPullsheet logic)
  const pushResult = await pushEquipmentToPullsheet(presupuestoId, items);

  return { presupuestoId, pushResult };
}
