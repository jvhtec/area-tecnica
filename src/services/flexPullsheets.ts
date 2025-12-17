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

async function fetchPullsheetLineItems(documentId: string, token: string): Promise<{ rootLineId: string; lastLineId: string } | null> {
  try {
    const url = `${FLEX_API_BASE_URL}/line-item/${encodeURIComponent(documentId)}/tree`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
        'apikey': token,
      },
    });

    if (!res.ok) {
      console.error('[FlexPullsheets] Failed to fetch line items:', res.status);
      return null;
    }

    const data = await res.json();

    // The tree structure should have a root line item and children
    // We'll add items as children of the root, after the last existing item
    const rootLineId = data?.id || data?.lineItemId;
    const children = data?.children || [];
    const lastLineId = children.length > 0 ? children[children.length - 1]?.id : '';

    if (!rootLineId) {
      console.error('[FlexPullsheets] No root line item found in tree');
      return null;
    }

    return { rootLineId, lastLineId };
  } catch (err) {
    console.error('[FlexPullsheets] Error fetching line items:', err);
    return null;
  }
}

async function addResourceLineItem(options: {
  documentId: string;
  resourceId: string;
  quantity: number;
  parentLineItemId: string;
  nextSiblingId: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  const { documentId, resourceId, quantity, parentLineItemId, nextSiblingId, token } = options;
  const baseUrl = `${FLEX_API_BASE_URL}/line-item/${encodeURIComponent(documentId)}/add-resource/${encodeURIComponent(resourceId)}`;

  const headers = {
    accept: '*/*',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Auth-Token': token,
    'apikey': token,
  };

  const form = new URLSearchParams({
    resourceParentId: '', // Empty for pullsheets
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

    const payload = await res.json().catch(() => null);
    if (!payload) {
      return { success: false, error: 'Invalid response from API' };
    }

    return { success: true };
  } catch (err) {
    console.error('[FlexPullsheets] Failed to add resource line item', err);
    return { success: false, error: 'Network error' };
  }
}

export interface EquipmentItem {
  resourceId: string;
  quantity: number;
  name: string;
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

  // Fetch the pullsheet line item structure
  console.log('[FlexPullsheets] Fetching pullsheet line item structure...');
  const lineItems = await fetchPullsheetLineItems(pullsheetElementId, token);

  if (!lineItems) {
    console.error('[FlexPullsheets] Failed to fetch line item structure');
    equipment.forEach(item => {
      result.failed.push({ name: item.name, error: 'Failed to fetch pullsheet structure' });
    });
    return result;
  }

  console.log('[FlexPullsheets] Line items:', lineItems);

  // Push each equipment item sequentially
  // Each new item becomes the nextSiblingId for the following item
  let currentNextSiblingId = lineItems.lastLineId;

  for (const item of equipment) {
    console.log(`[FlexPullsheets] Pushing ${item.name} (qty: ${item.quantity}, resourceId: ${item.resourceId})`);

    const response = await addResourceLineItem({
      documentId: pullsheetElementId,
      resourceId: item.resourceId,
      quantity: item.quantity,
      parentLineItemId: lineItems.rootLineId,
      nextSiblingId: currentNextSiblingId,
      token,
    });

    if (response.success) {
      result.succeeded++;
      console.log(`[FlexPullsheets] ✓ Successfully pushed ${item.name}`);
      // Update nextSiblingId for the next item (empty string means add at the end)
      currentNextSiblingId = '';
    } else {
      result.failed.push({ name: item.name, error: response.error || 'Unknown error' });
      console.error(`[FlexPullsheets] ✗ Failed to push ${item.name}:`, response.error);
    }
  }

  console.log('[FlexPullsheets] Push complete:', result);
  return result;
}
