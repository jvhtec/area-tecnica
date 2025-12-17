import { supabase } from '@/integrations/supabase/client';
import { FLEX_API_BASE_URL } from '@/lib/api-config';

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
}

export interface PushResult {
  succeeded: number;
  failed: Array<{ name: string; error: string }>;
}

interface CategoryHeader {
  name: string;
  resourceId: string;
  category: string;
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

  // Fetch category headers from equipment table
  const { data: categoryHeaders, error: categoryError } = await supabase
    .from('equipment')
    .select('name, resource_id, category')
    .not('resource_id', 'is', null)
    .in('category', ['foh_console', 'mon_console', 'wireless', 'iem', 'wired_mics']);

  if (categoryError) {
    console.error('[FlexPullsheets] Failed to fetch category headers:', categoryError);
  }

  // Create a map of categories to their resource IDs (for virtual category items)
  const categoryMap = new Map<string, string>();
  if (categoryHeaders) {
    // Look for items that could be category headers (e.g., "Control FoH", "Control Mon", etc.)
    categoryHeaders.forEach(item => {
      const nameLower = item.name.toLowerCase();
      if (nameLower.includes('control foh') || nameLower.includes('foh console')) {
        categoryMap.set('foh_console', item.resource_id!);
      } else if (nameLower.includes('control mon') || nameLower.includes('monitor console')) {
        categoryMap.set('mon_console', item.resource_id!);
      } else if (nameLower.includes('microfonia rf') || nameLower.includes('wireless')) {
        categoryMap.set('wireless', item.resource_id!);
      } else if (nameLower.includes('rack iem') || nameLower.includes('iem')) {
        categoryMap.set('iem', item.resource_id!);
      } else if (nameLower.includes('microfonia')) {
        categoryMap.set('wired_mics', item.resource_id!);
      }
    });
  }

  console.log('[FlexPullsheets] Category map:', categoryMap);

  // Group equipment by category
  const equipmentByCategory = new Map<string, EquipmentItem[]>();
  equipment.forEach(item => {
    const category = item.category || 'uncategorized';
    if (!equipmentByCategory.has(category)) {
      equipmentByCategory.set(category, []);
    }
    equipmentByCategory.get(category)!.push(item);
  });

  // Track category line IDs for nesting
  const categoryLineIds = new Map<string, string>();

  // Process each category
  for (const [category, items] of equipmentByCategory.entries()) {
    console.log(`[FlexPullsheets] Processing category: ${category} with ${items.length} items`);

    let parentLineItemId = ''; // Default to root level

    // If we have a category header resource ID, create the category first
    if (categoryMap.has(category)) {
      const categoryResourceId = categoryMap.get(category)!;
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
