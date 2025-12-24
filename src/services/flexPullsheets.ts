import { supabase } from '@/integrations/supabase/client';
import { FLEX_API_BASE_URL } from '@/lib/api-config';
import type { PresetSubsystem } from '@/types/equipment';

let cachedFlexToken: string | null = null;

// Material de sonido is a root-only grouping in Flex and intentionally omitted here.
export const FLEX_CATEGORY_MAP = new Map<string, string>([
  ['foh_console', '98905ca2-b094-45bc-ad5b-67fe311a48e8'], // Control FoH
  ['mon_console', 'aadfee39-e5e4-4a68-b7d8-03d55b3f29f8'], // Control Mon
  ['wireless', 'a8f2e63b-55f1-4531-83a4-835232d2bd04'], // Microfonia RF
  ['iem', '5194620b-ed50-4a31-bf6b-a986614b3d2d'], // Rack IEM
  ['wired_mics', '9a33f593-67e9-462d-b085-e7e215f5da72'], // Microfonia
  ['pa_mains', 'd83de363-5f9b-46e4-8e11-5bee0ef30137'], // Sistema de PA
  ['pa_downfill', 'aeb78382-d19c-4314-bbbe-5bbe5e5d3cd4'],
  ['pa_outfill', 'd8e2ce25-4370-469c-8980-61760569492a'],
  ['pa_subs', '61aba524-61db-43a9-935d-147ec287888e'],
  ['pa_frontfill', 'd9b588e6-b9a8-4327-baa5-fecf104a6775'],
  ['pa_delays', 'e38db281-4b27-40eb-a846-e4a27db3961f'],
  ['pa_amp', '9d463da6-40f1-4ab0-9a96-123fd0025f88'],
]);

const SUBSYSTEM_TO_FLEX_CATEGORY: Record<PresetSubsystem, string> = {
  mains: 'pa_mains',
  outs: 'pa_outfill',
  subs: 'pa_subs',
  fronts: 'pa_frontfill',
  delays: 'pa_delays',
  other: 'pa_mains',
  amplification: 'pa_amp',
};

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

async function addResourceLineItem(options: {
  documentId: string;
  resourceId: string;
  quantity: number;
  parentLineItemId?: string;
  nextSiblingId?: string;
  token: string;
}): Promise<{ success: boolean; error?: string; lineItemId?: string }> {
  const { documentId, resourceId, quantity, parentLineItemId = '', nextSiblingId = '', token } = options;
  const baseUrl = `${FLEX_API_BASE_URL}/line-item/${encodeURIComponent(documentId)}/add-resource/${encodeURIComponent(resourceId)}`;

  const headers = {
    accept: '*/*',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Auth-Token': token,
    'apikey': token,
  };

  const form = new URLSearchParams({
    resourceParentId: '', // Empty for root-level additions
    managedResourceLineItemType: 'inventory-model', // Correct type for equipment
    quantity: String(quantity),
    parentLineItemId: parentLineItemId,
    nextSiblingId: nextSiblingId,
  });

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: form.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('[FlexPullsheets] API error:', res.status, errorText);
      return { success: false, error: `API error: ${res.status}` };
    }

    const payload = await res.json().catch(() => null) as {
      addedResourceLineIds?: string[];
    } | null;

    if (!payload) {
      return { success: false, error: 'Invalid response from API' };
    }

    // Extract the first line item ID from the response
    const lineItemId = payload.addedResourceLineIds?.[0];

    return { success: true, lineItemId };
  } catch (err) {
    console.error('[FlexPullsheets] Failed to add resource line item', err);
    return { success: false, error: 'Network error' };
  }
}

export interface EquipmentItem {
  resourceId: string;
  quantity: number;
  name: string;
  category?: string;
  subsystem?: PresetSubsystem | null;
  flexCategoryKey?: string;
}

function resolveFlexCategoryKey(item: EquipmentItem): string {
  if (item.flexCategoryKey) return item.flexCategoryKey;

  if (item.subsystem) {
    const subsystemKey = SUBSYSTEM_TO_FLEX_CATEGORY[item.subsystem];
    if (subsystemKey) return subsystemKey;
  }

  if (item.category) {
    return item.category;
  }

  return 'uncategorized';
}

function normalizeEquipmentItems(
  equipment: EquipmentItem[]
): Array<EquipmentItem & { flexCategoryKey: string }> {
  const aggregated = new Map<string, EquipmentItem & { flexCategoryKey: string }>();

  equipment.forEach((item) => {
    const flexCategoryKey = resolveFlexCategoryKey(item);
    const mergeKey = `${flexCategoryKey}:${item.resourceId}`;
    const existing = aggregated.get(mergeKey);

    if (existing) {
      existing.quantity += item.quantity;
      if (!existing.subsystem && item.subsystem) {
        existing.subsystem = item.subsystem;
      }
      if (!existing.category && item.category) {
        existing.category = item.category;
      }
      return;
    }

    aggregated.set(mergeKey, {
      ...item,
      flexCategoryKey,
    });
  });

  return Array.from(aggregated.values());
}

export interface PushResult {
  succeeded: number;
  failed: Array<{ name: string; error: string }>;
}

export async function pushEquipmentToPullsheet(
  pullsheetElementId: string,
  equipment: EquipmentItem[]
): Promise<PushResult> {
  console.log('[FlexPullsheets] Starting push to pullsheet', pullsheetElementId);
  console.log('[FlexPullsheets] Equipment to push:', equipment);

  const result: PushResult = {
    succeeded: 0,
    failed: [],
  };

  // Get auth token
  let token: string;
  try {
    token = await getFlexAuthToken();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[FlexPullsheets] Failed to get auth token:', errorMessage);
    // Mark all items as failed
    equipment.forEach(item => {
      result.failed.push({ name: item.name, error: 'Authentication failed' });
    });
    return result;
  }

  const normalizedItems = normalizeEquipmentItems(equipment);

  console.log('[FlexPullsheets] Using category headers:', Array.from(FLEX_CATEGORY_MAP.entries()));

  // Group equipment by resolved Flex category key
  const equipmentByCategory = new Map<string, Array<EquipmentItem & { flexCategoryKey: string }>>();
  normalizedItems.forEach(item => {
    if (!equipmentByCategory.has(item.flexCategoryKey)) {
      equipmentByCategory.set(item.flexCategoryKey, []);
    }
    equipmentByCategory.get(item.flexCategoryKey)!.push(item);
  });

  // Track category line IDs for nesting
  // Process each category
  for (const [category, items] of equipmentByCategory.entries()) {
    console.log(`[FlexPullsheets] Processing category: ${category} with ${items.length} items`);

    let parentLineItemId = ''; // Default to root level

    // If we have a category header resource ID, create the category first
    if (FLEX_CATEGORY_MAP.has(category)) {
      const categoryResourceId = FLEX_CATEGORY_MAP.get(category)!;
      console.log(`[FlexPullsheets] Creating category header: ${category}`);

      const categoryResponse = await addResourceLineItem({
        documentId: pullsheetElementId,
        resourceId: categoryResourceId,
        quantity: 1,
        token,
      });

      if (categoryResponse.success && categoryResponse.lineItemId) {
        parentLineItemId = categoryResponse.lineItemId;
        console.log(`[FlexPullsheets] ✓ Category ${category} created with ID: ${parentLineItemId}`);
      } else {
        console.error(`[FlexPullsheets] ✗ Failed to create category ${category}`);
      }
    }

    // Add equipment items (either nested under category or at root)
    for (const item of items) {
      console.log(`[FlexPullsheets] Pushing ${item.name} (qty: ${item.quantity}, resourceId: ${item.resourceId}, parent: ${parentLineItemId || 'root'})`);

      const response = await addResourceLineItem({
        documentId: pullsheetElementId,
        resourceId: item.resourceId,
        quantity: item.quantity,
        parentLineItemId: parentLineItemId,
        token,
      });

      if (response.success) {
        result.succeeded++;
        console.log(`[FlexPullsheets] ✓ Successfully pushed ${item.name}`);
      } else {
        result.failed.push({ name: item.name, error: response.error || 'Unknown error' });
        console.error(`[FlexPullsheets] ✗ Failed to push ${item.name}:`, response.error);
      }
    }
  }

  console.log('[FlexPullsheets] Push complete:', result);
  return result;
}

export interface JobPullsheet {
  id: string;
  element_id: string;
  department: string | null;
  created_at: string;
  display_name?: string;
  source?: 'database' | 'flex_api';
}

// Pullsheet definition ID from Flex API
const PULLSHEET_DEFINITION_ID = 'a220432c-af33-11df-b8d5-00e08175e43e';
// Some Flex tree responses omit definitionId; pullsheets still have this domainId.
const PULLSHEET_DOMAIN_ID = 'equipment-list';

// Maximum recursion depth to prevent stack overflow
const MAX_TREE_DEPTH = 50;

// Interface for Flex API tree nodes
interface FlexTreeNode {
  elementId?: string;
  nodeId?: string;
  id?: string;
  definitionId?: string;
  elementDefinitionId?: string;
  domainId?: string;
  leaf?: boolean;
  documentNumber?: string;
  displayName?: string;
  name?: string;
  createdAt?: string;
  created_at?: string;
  dateCreated?: string;
  date_created?: string;
  children?: FlexTreeNode[];
  [key: string]: unknown;
}

/**
 * Query pullsheets for a specific job from database only
 * @param jobId The job ID to query pullsheets for
 * @returns Array of pullsheet records with their element IDs (limited to 100 most recent)
 */
export async function getJobPullsheets(jobId: string): Promise<JobPullsheet[]> {
  const { data, error } = await supabase
    .from('flex_folders')
    .select('id, element_id, department, created_at')
    .eq('job_id', jobId)
    .eq('folder_type', 'pull_sheet')
    .order('department', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[FlexPullsheets] Failed to query pullsheets:', error);
    throw new Error(`Failed to query pullsheets: ${error.message}`);
  }

  return (data || []).map(ps => ({ ...ps, source: 'database' as const }));
}

/**
 * Query pullsheets for a specific job from both database and Flex API
 * This captures pullsheets created before tracking was implemented or created in parallel
 * @param jobId The job ID to query pullsheets for
 * @returns Array of pullsheet records merged from DB and Flex API, deduplicated by element_id
 */
export async function getJobPullsheetsWithFlexApi(jobId: string): Promise<JobPullsheet[]> {
  // Get pullsheets from database
  const dbPullsheets = await getJobPullsheets(jobId);

  try {
    // Get main element ID for this job
    const { data: mainFolder, error: mainFolderError } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .or('folder_type.eq.main_event,folder_type.eq.main')
      .single();

    if (mainFolderError || !mainFolder?.element_id) {
      console.warn('[FlexPullsheets] No main folder found for job, returning DB results only:', mainFolderError);
      return dbPullsheets;
    }

    // Fetch Flex tree with timeout
    const token = await getFlexAuthToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let treeData;
    try {
      const response = await fetch(
        `${FLEX_API_BASE_URL}/element/${mainFolder.element_id}/tree`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token,
            'apikey': token,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[FlexPullsheets] Failed to fetch Flex tree, returning DB results only');
        return dbPullsheets;
      }

      // Parse JSON inside try-catch to handle parsing errors
      try {
        treeData = await response.json();
      } catch (jsonError) {
        console.warn('[FlexPullsheets] Failed to parse Flex tree JSON, returning DB results only:', jsonError);
        return dbPullsheets;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[FlexPullsheets] Flex API request timed out, returning DB results only');
      } else {
        console.warn('[FlexPullsheets] Flex API request failed, returning DB results only:', fetchError);
      }
      return dbPullsheets;
    }

    // Extract pullsheets from tree (recursively search for nodes with pullsheet definitionId)
    const flexPullsheets = extractPullsheetsFromTree(treeData);

    // Merge and deduplicate
    const dbElementIds = new Set(dbPullsheets.map(ps => ps.element_id));
    const uniqueFlexPullsheets = flexPullsheets.filter(ps => !dbElementIds.has(ps.element_id));

    console.log(`[FlexPullsheets] Found ${dbPullsheets.length} from DB, ${uniqueFlexPullsheets.length} new from Flex API`);

    return [...dbPullsheets, ...uniqueFlexPullsheets];
  } catch (error) {
    console.warn('[FlexPullsheets] Error fetching from Flex API, returning DB results only:', error);
    return dbPullsheets;
  }
}

/**
 * Recursively extract pullsheet nodes from Flex API tree response
 */
function extractPullsheetsFromTree(node: FlexTreeNode | FlexTreeNode[], depth: number = 0): JobPullsheet[] {
  // Depth protection to prevent stack overflow
  if (depth > MAX_TREE_DEPTH) {
    console.warn(`[FlexPullsheets] Max tree depth (${MAX_TREE_DEPTH}) exceeded, stopping recursion`);
    return [];
  }

  if (!node) {
    return [];
  }

  // If node is an array, process each element
  if (Array.isArray(node)) {
    const results: JobPullsheet[] = [];
    for (const item of node) {
      results.push(...extractPullsheetsFromTree(item, depth));
    }
    return results;
  }

  const results: JobPullsheet[] = [];

  // Check if current node is a pullsheet
  const elementId = node.elementId || node.nodeId || node.id;
  const definitionId = node.definitionId || node.elementDefinitionId;
  const domainId = node.domainId;
  const isLeaf =
    node.leaf === true ||
    (node.leaf === undefined && (!Array.isArray(node.children) || node.children.length === 0));
  const displayName =
    node.displayName ||
    (node.name && node.documentNumber ? `${node.name} (${node.documentNumber})` : node.name);

  const isPullsheet =
    (elementId && definitionId === PULLSHEET_DEFINITION_ID) ||
    (elementId && domainId === PULLSHEET_DOMAIN_ID && isLeaf);

  if (isPullsheet) {
    // Try to extract creation date from various possible fields
    const createdAt =
      node.createdAt ||
      node.created_at ||
      node.dateCreated ||
      node.date_created ||
      // Fallback to a far past date so Flex API items sort before DB items
      '2000-01-01T00:00:00.000Z';

    const pullsheet: JobPullsheet = {
      id: elementId,
      element_id: elementId,
      department: null, // We don't have department info from Flex tree
      created_at: createdAt,
      display_name: displayName,
      source: 'flex_api',
    };

    results.push(pullsheet);
  }

  // Recursively search children
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...extractPullsheetsFromTree(child, depth + 1));
    }
  }

  return results;
}
