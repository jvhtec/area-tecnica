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
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  const { documentId, resourceId, quantity, token } = options;
  const baseUrl = `${FLEX_API_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/add-resource/${encodeURIComponent(resourceId)}`;

  const query = new URLSearchParams({
    resourceParentId: documentId, // Use pullsheet itself as parent
    managedResourceLineItemType: 'resource', // Equipment is 'resource' not 'service-offering'
    quantity: String(quantity),
  });

  const tryRequest = async (init: RequestInit): Promise<Record<string, unknown> | null> => {
    try {
      const res = await fetch(`${baseUrl}?${query.toString()}`, init);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('[FlexPullsheets] API error:', res.status, errorText);
        return null;
      }
      return await res.json().catch(() => null);
    } catch (err) {
      console.error('[FlexPullsheets] Failed to add resource line item', err);
      return null;
    }
  };

  const headers = { accept: '*/*', 'X-Auth-Token': token, 'apikey': token } as Record<string, string>;

  // Try JSON POST first
  let payload = await tryRequest({ method: 'POST', headers });

  // Fallback to form-encoded POST if JSON fails
  if (!payload) {
    const fallbackHeaders = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    };
    const form = new URLSearchParams({
      resourceParentId: documentId,
      managedResourceLineItemType: 'resource',
      quantity: String(quantity),
      parentLineItemId: '',
      nextSiblingId: '',
    });
    payload = await tryRequest({ method: 'POST', headers: fallbackHeaders, body: form.toString() });
  }

  if (!payload) {
    return { success: false, error: 'Failed to add line item to Flex' };
  }

  return { success: true };
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

  // Push each equipment item sequentially
  for (const item of equipment) {
    console.log(`[FlexPullsheets] Pushing ${item.name} (qty: ${item.quantity}, resourceId: ${item.resourceId})`);

    const response = await addResourceLineItem({
      documentId: pullsheetElementId,
      resourceId: item.resourceId,
      quantity: item.quantity,
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

  console.log('[FlexPullsheets] Push complete:', result);
  return result;
}
