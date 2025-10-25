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

export interface ElementDetails {
  elementId: string;
  definitionId?: string;
  name?: string;
  documentNumber?: string;
}

/**
 * Fetches element details from Flex API to get definitionId
 */
export async function getElementDetails(
  elementId: string,
  authToken: string
): Promise<ElementDetails> {
  try {
    const response = await fetch(
      `https://sectorpro.flexrentalsolutions.com/f5/api/element/${elementId}/key-info/`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': authToken,
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch element details for ${elementId}: ${response.statusText}`);
      return { elementId };
    }

    const data = await response.json();
    
    // Extract definitionId from the response
    // The response structure has fields wrapped in objects with data property
    const definitionId = data?.elementDefinitionId?.data || data?.definitionId?.data || data?.definitionId;
    const name = data?.name?.data || data?.documentName?.data;
    const documentNumber = data?.documentNumber?.data;

    return {
      elementId,
      definitionId,
      name,
      documentNumber,
    };
  } catch (error) {
    console.error('Error fetching element details:', error);
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
 * Builds the appropriate Flex URL for an element based on its type
 * 
 * @param elementId - The element/document ID
 * @param definitionId - Optional definition ID to determine element type
 * @returns Formatted Flex URL
 */
export function buildFlexUrl(elementId: string, definitionId?: string): string {
  if (isFinancialDocument(definitionId)) {
    // Financial document URL format
    return `${FLEX_BASE_URL}#fin-doc/${elementId}/doc-view/${PRESUPUESTO_VIEW_ID}/header`;
  }
  
  // Default simple element URL format
  return `${FLEX_BASE_URL}#element/${elementId}/view/simple-element/header`;
}

/**
 * Builds a Flex URL with element type detection
 * Fetches element details if needed to determine the correct URL format
 * 
 * @param elementId - The element ID to open
 * @param authToken - Flex API authentication token
 * @returns Promise with the formatted Flex URL
 */
export async function buildFlexUrlWithTypeDetection(
  elementId: string,
  authToken: string
): Promise<string> {
  const details = await getElementDetails(elementId, authToken);
  return buildFlexUrl(elementId, details.definitionId);
}
