import { FLEX_FOLDER_IDS } from './constants';

const FLEX_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop';

// Standard view IDs for different document types in Flex
const PRESUPUESTO_VIEW_ID = 'ca6b072c-b122-11df-b8d5-00e08175e43e';

// Known financial document definition IDs
const FINANCIAL_DOCUMENT_DEFINITION_IDS = [
  FLEX_FOLDER_IDS.presupuesto, // 9bfb850c-b117-11df-b8d5-00e08175e43e
  FLEX_FOLDER_IDS.presupuestoDryHire, // fb8b82c9-41d6-4b8f-99b6-4ab8276d06aa
  FLEX_FOLDER_IDS.hojaGastos, // 566d32e0-1a1e-11e0-a472-00e08175e43e
  FLEX_FOLDER_IDS.ordenCompra, // ff1a5a50-3f1d-11df-b8d5-00e08175e43e
  FLEX_FOLDER_IDS.ordenSubalquiler, // 7e2ae0d0-b0bc-11df-b8d5-00e08175e43e
  FLEX_FOLDER_IDS.ordenTrabajo, // f6e70edc-f42d-11e0-a8de-00e08175e43e
  FLEX_FOLDER_IDS.crewCall, // 253878cc-af31-11df-b8d5-00e08175e43e
  FLEX_FOLDER_IDS.pullSheet, // a220432c-af33-11df-b8d5-00e08175e43e
];

// Known simple folder/subfolder definition IDs that should use simple-element URLs
const SIMPLE_ELEMENT_DEFINITION_IDS = [
  FLEX_FOLDER_IDS.mainFolder, // e281e71c-2c42-49cd-9834-0eb68135e9ac
  FLEX_FOLDER_IDS.subFolder, // 358f312c-b051-11df-b8d5-00e08175e43e
];

export interface ElementDetails {
  elementId: string;
  definitionId?: string;
  name?: string;
  documentNumber?: string;
}

/**
 * Fetches element details from Flex API to get definitionId
 * @param elementId - The element ID to fetch
 * @param authToken - Flex API authentication token
 * @returns Element details including definitionId
 */
export async function getElementDetails(
  elementId: string,
  authToken: string
): Promise<ElementDetails> {
  try {
    console.log(`[buildFlexUrl] Fetching element details for ${elementId}`);
    
    const response = await fetch(
      `https://sectorpro.flexrentalsolutions.com/f5/api/element/${elementId}/key-info/`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': authToken,
          'apikey': authToken,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[buildFlexUrl] Failed to fetch element details for ${elementId}: ${response.statusText}`);
      return { elementId };
    }

    const data = await response.json();
    
    // Extract definitionId from the response
    // The response structure has fields wrapped in objects with data property
    const definitionId = data?.elementDefinitionId?.data || data?.definitionId?.data || data?.definitionId;
    const name = data?.name?.data || data?.documentName?.data;
    const documentNumber = data?.documentNumber?.data;

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

/**
 * Determines if an element is a financial document (presupuesto, orden, etc.)
 * based on its definitionId
 */
export function isFinancialDocument(definitionId?: string): boolean {
  if (!definitionId) return false;
  return FINANCIAL_DOCUMENT_DEFINITION_IDS.includes(definitionId);
}

/**
 * Determines if an element is a simple folder/subfolder
 * based on its definitionId
 */
export function isSimpleFolder(definitionId?: string): boolean {
  if (!definitionId) return false;
  return SIMPLE_ELEMENT_DEFINITION_IDS.includes(definitionId);
}

/**
 * Builds the appropriate Flex URL for an element based on its type
 * 
 * @param elementId - The element/document ID
 * @param definitionId - Optional definition ID to determine element type
 * @returns Formatted Flex URL
 * 
 * @remarks
 * This function handles multiple element types:
 * - Financial documents (presupuesto, orden, etc.) use #fin-doc URL format
 * - Simple elements (folders, subfolders) use #element URL format
 * - Dryhire jobs store the subfolder element_id (simple element)
 * - Tourdate jobs store subfolder element_ids (simple elements)
 * - Default fallback is simple element URL format
 */
export function buildFlexUrl(elementId: string, definitionId?: string): string {
  console.log('[buildFlexUrl] Building URL', {
    elementId,
    elementIdValid: !!elementId && elementId.trim().length > 0,
    definitionId,
    isFinancialDoc: isFinancialDocument(definitionId),
    isSimpleFolder: isSimpleFolder(definitionId),
  });

  // Validate elementId
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = `Invalid elementId provided to buildFlexUrl: "${elementId}"`;
    console.error('[buildFlexUrl]', error);
    throw new Error(error);
  }
  
  if (isFinancialDocument(definitionId)) {
    // Financial document URL format (presupuesto, hojaGastos, ordenCompra, etc.)
    const url = `${FLEX_BASE_URL}#fin-doc/${elementId}/doc-view/${PRESUPUESTO_VIEW_ID}/header`;
    console.log('[buildFlexUrl] Built financial document URL:', {
      url,
      elementId,
      definitionId,
      urlType: 'fin-doc',
    });
    return url;
  }
  
  // Default simple element URL format
  // This handles:
  // - Simple folders and subfolders (mainFolder, subFolder)
  // - Dryhire subfolders (folder_type='dryhire' in database)
  // - Tourdate subfolders (folder_type='tourdate' in database)
  // - Any other element type not explicitly handled
  const url = `${FLEX_BASE_URL}#element/${elementId}/view/simple-element/header`;
  console.log('[buildFlexUrl] Built simple element URL:', {
    url,
    elementId,
    definitionId: definitionId || 'none',
    urlType: 'simple-element',
  });
  return url;
}

export interface ElementContext {
  /**
   * Job type - helps determine if this is a dryhire or tourdate subfolder
   */
  jobType?: 'single' | 'festival' | 'dryhire' | 'tourdate';
  /**
   * Folder type from the database - indicates the element type
   */
  folderType?: 'main' | 'dryhire' | 'tourdate';
  /**
   * If we already know the definitionId, we can skip the API call
   */
  definitionId?: string;
}

/**
 * Builds a Flex URL with element type detection
 * Fetches element details if needed to determine the correct URL format
 * 
 * @param elementId - The element ID to open
 * @param authToken - Flex API authentication token
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
  authToken: string,
  context?: ElementContext
): Promise<string> {
  console.log('[buildFlexUrl] Starting type detection', {
    elementId,
    elementIdValid: !!elementId && elementId.trim().length > 0,
    hasAuthToken: !!authToken,
    authTokenLength: authToken?.length || 0,
    hasContext: !!context,
    context,
  });

  // Validate inputs
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = `Invalid elementId in buildFlexUrlWithTypeDetection: "${elementId}"`;
    console.error('[buildFlexUrl]', error);
    throw new Error(error);
  }

  if (!authToken || typeof authToken !== 'string' || authToken.trim().length === 0) {
    console.warn('[buildFlexUrl] Invalid authToken, will attempt to build URL without API call', {
      hasAuthToken: !!authToken,
      authTokenType: typeof authToken,
    });
  }
  
  // If context provides definitionId, we can skip the API call
  if (context?.definitionId) {
    console.log('[buildFlexUrl] Using definitionId from context (optimization)', {
      definitionId: context.definitionId,
      elementId,
    });
    const url = buildFlexUrl(elementId, context.definitionId);
    console.log('[buildFlexUrl] Built URL from context definitionId:', { url, elementId });
    return url;
  }
  
  // If context indicates dryhire or tourdate, we know it's a subfolder (simple element)
  if (context?.folderType === 'dryhire' || context?.folderType === 'tourdate' || 
      context?.jobType === 'dryhire' || context?.jobType === 'tourdate') {
    console.log('[buildFlexUrl] Context indicates dryhire/tourdate subfolder (optimization)', {
      folderType: context?.folderType,
      jobType: context?.jobType,
      elementId,
    });
    const url = buildFlexUrl(elementId); // No definitionId = simple element URL
    console.log('[buildFlexUrl] Built simple-element URL from context:', { url, elementId });
    return url;
  }
  
  // Otherwise, fetch element details from API
  try {
    console.log('[buildFlexUrl] No context optimization available, fetching element details from API', {
      elementId,
      hasAuthToken: !!authToken,
    });
    const details = await getElementDetails(elementId, authToken);
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
