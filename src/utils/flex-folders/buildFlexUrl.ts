import { flexApiFetch } from '@/lib/flex-api-client';
import {
  detectFlexLinkIntent,
  IntentDetectionContext,
  isFinancialDocument,
  isSimpleFolder,
  isSimpleProjectElement,
} from './intentDetection';
import { buildFlexUrlByIntent } from './urlBuilder';

export interface ElementDetails {
  elementId: string;
  definitionId?: string;
  name?: string;
  documentNumber?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapFlexField(value: unknown): unknown {
  return isRecord(value) && 'data' in value ? value.data : value;
}

function optionalString(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

/**
 * Fetches element details from Flex API to get definitionId
 * @param elementId - The element ID to fetch
 * @returns Element details including definitionId
 */
export async function getElementDetails(
  elementId: string
): Promise<ElementDetails> {
  try {
    console.log(`[buildFlexUrl] Fetching element details for ${elementId}`);
    
    const response = await flexApiFetch(
      `/element/${encodeURIComponent(elementId)}/key-info/`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`[buildFlexUrl] Failed to fetch element details for ${elementId}: ${response.statusText}`);
      return { elementId };
    }

    const data = await response.json<Record<string, unknown>>();
    
    // Extract definitionId from the response
    // The response structure has fields wrapped in objects with data property
    const definitionId = optionalString(unwrapFlexField(data.elementDefinitionId) || unwrapFlexField(data.definitionId));
    const name = optionalString(unwrapFlexField(data.name) || unwrapFlexField(data.documentName));
    const documentNumber = optionalString(unwrapFlexField(data.documentNumber));

    console.log(`[buildFlexUrl] Element details fetched:`, { elementId, definitionId, name, documentNumber });

    return {
      elementId,
      definitionId,
      name,
      documentNumber,
    };
  } catch (error) {
    console.error('[buildFlexUrl] Error fetching element details:', error);
    return { elementId };
  }
}

// Re-export intent detection helpers for backward compatibility
export { isFinancialDocument, isSimpleFolder, isSimpleProjectElement } from './intentDetection';

/**
 * Builds the appropriate Flex URL for an element based on its type
 * 
 * @param elementId - The element/document ID
 * @param definitionId - Optional definition ID to determine element type
 * @param domainId - Optional domain ID from tree API to determine element type
 * @returns Formatted Flex URL
 * 
 * @remarks
 * This function handles multiple element types:
 * - domainId = "simple-project-element" uses #element URL format
 * - Financial documents (presupuesto, orden, etc.) use #fin-doc URL format
 * - Crew call/contact lists use #contact-list URL format
 * - Equipment lists use #equipment-list URL format
 * - Remote file lists use #remote-file-list URL format
 * - Simple elements (folders, subfolders) use #element URL format
 * - Dryhire jobs store the subfolder element_id (simple element)
 * - Tourdate jobs store subfolder element_ids (simple elements)
 * - Default fallback is simple element URL format
 */
export function buildFlexUrl(elementId: string, definitionId?: string, domainId?: string): string {
  const context: IntentDetectionContext = {
    definitionId,
    domainId,
  };

  const intent = detectFlexLinkIntent(context);

  console.log('[buildFlexUrl] Building URL', {
    elementId,
    elementIdType: typeof elementId,
    elementIdValid: !!elementId && elementId.trim().length > 0,
    definitionId,
    domainId,
    detectedIntent: intent,
  });

  // Validate elementId
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = `Invalid elementId provided to buildFlexUrl: "${elementId}" (type: ${typeof elementId})`;
    console.error('[buildFlexUrl]', error);
    throw new Error(error);
  }

  try {
    const url = buildFlexUrlByIntent(intent, elementId);
    console.log('[buildFlexUrl] Built URL:', {
      url,
      elementId,
      intent,
    });
    return url;
  } catch (error) {
    console.error('[buildFlexUrl] Error building URL:', error);
    throw error;
  }
}

// Re-export IntentDetectionContext as ElementContext for backward compatibility
export type ElementContext = IntentDetectionContext;

/**
 * Builds a Flex URL with element type detection
 * Fetches element details if needed to determine the correct URL format
 * 
 * @param elementId - The element ID to open
 * @param context - Optional context about the element to avoid extra API calls
 * @returns Promise with the formatted Flex URL
 * 
 * @remarks
 * This function attempts to fetch element details from Flex API to determine
 * the correct URL format. If the API call fails, it falls back to simple-element
 * URL format which works for most element types including dryhire and tourdate subfolders.
 * 
 * If context is provided with definitionId or folderType, it can skip the API call:
 * - dryhire jobs use subfolder elements (simple-element URL)
 * - tourdate jobs use subfolder elements (simple-element URL)
 * - main folders use simple-element URL
 * - financial documents use fin-doc URL
 */
export async function buildFlexUrlWithTypeDetection(
  elementId: string,
  context?: ElementContext
): Promise<string> {
  console.log('[buildFlexUrl] Starting type detection', {
    elementId,
    elementIdType: typeof elementId,
    elementIdValue: elementId,
    elementIdNull: elementId === null,
    elementIdUndefined: elementId === undefined,
    elementIdEmpty: elementId === '',
    elementIdValid: !!elementId && elementId.trim().length > 0,
    elementIdLength: elementId?.length || 0,
    hasContext: !!context,
    context,
  });

  // Validate inputs
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = `Invalid elementId in buildFlexUrlWithTypeDetection: "${elementId}" (type: ${typeof elementId})`;
    console.error('[buildFlexUrl]', error, {
      elementId,
      elementIdType: typeof elementId,
      elementIdValue: elementId,
      context,
      stack: new Error().stack,
    });
    throw new Error(error);
  }

  // If context provides strong, unambiguous information for intent detection, use it
  const hasStrongDefinition = !!context?.definitionId;
  const isExplicitView = !!(context?.viewHint && context.viewHint !== 'auto');
  const isDryhireOrTourdate =
    context?.folderType === 'dryhire' ||
    context?.folderType === 'tourdate' ||
    context?.jobType === 'dryhire' ||
    context?.jobType === 'tourdate';
  const domain = context?.domainId?.toLowerCase();
  const hasStrongDomain = !!domain && (
    domain === 'fin-doc' ||
    domain === 'financial-document' ||
    domain === 'financial-doc' ||
    domain === 'presupuesto' ||
    domain === 'expense-sheet' ||
    domain === 'expense' ||
    domain === 'expense-list' ||
    domain === 'crew-call' ||
    domain === 'contact-list' ||
    domain === 'contact-list-element' ||
    domain === 'equipment-list' ||
    domain === 'equipment' ||
    domain === 'equipment-schedule' ||
    domain === 'remote-file-list' ||
    domain === 'remote-files' ||
    domain === 'file-list'
  );

  if (hasStrongDefinition || isExplicitView || isDryhireOrTourdate || hasStrongDomain) {
    console.log('[buildFlexUrl] Using context for intent detection (optimization)', {
      context,
      elementId,
    });

    const intent = detectFlexLinkIntent(context);
    const url = buildFlexUrlByIntent(intent, elementId);

    console.log('[buildFlexUrl] Built URL from context:', {
      url,
      elementId,
      intent,
    });
    return url;
  }
  
  // Otherwise, fetch element details from API
  try {
    console.log('[buildFlexUrl] No context optimization available, fetching element details from API', {
      elementId,
    });
    const details = await getElementDetails(elementId);
    console.log('[buildFlexUrl] Element details fetched from API:', {
      elementId,
      definitionId: details.definitionId,
      name: details.name,
    });
    const url = buildFlexUrl(elementId, details.definitionId);
    console.log('[buildFlexUrl] Successfully built URL with API type detection:', {
      url,
      elementId,
      definitionId: details.definitionId,
    });
    return url;
  } catch (error) {
    console.error('[buildFlexUrl] Error in type detection, falling back to simple element URL:', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      elementId,
      context,
    });
    // Fallback to simple element URL on any error
    console.log('[buildFlexUrl] Using fallback simple-element URL after error');
    return buildFlexUrl(elementId);
  }
}
