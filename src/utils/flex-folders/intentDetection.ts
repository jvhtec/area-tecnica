import { FLEX_FOLDER_IDS } from './constants';

/**
 * Flex link intent types
 * Each intent corresponds to a different URL schema in the Flex system
 */
export type FlexLinkIntent =
  | 'simple-element'    // Folders, subfolders, dryhire, tourdate
  | 'fin-doc'           // Financial documents (presupuesto, hojaGastos, ordenes)
  | 'contact-list'      // Crew call/contact list
  | 'equipment-list'    // Pull sheet/equipment list
  | 'remote-file-list'; // Remote file list

/**
 * Context information that can help determine the correct intent
 */
export interface IntentDetectionContext {
  /**
   * Job type - helps determine if this is a dryhire or tourdate subfolder
   */
  jobType?: 'single' | 'festival' | 'dryhire' | 'tourdate';
  /**
   * Folder type from the database - indicates the element type
   */
  folderType?: 'main' | 'dryhire' | 'tourdate';
  /**
   * Element definition ID from Flex API
   */
  definitionId?: string;
  /**
   * Domain ID from tree API (e.g., "simple-project-element")
   */
  domainId?: string;
  /**
   * Schema ID that may indicate the element type
   */
  schemaId?: string;
  /**
   * Explicit view hint to force a specific intent
   */
  viewHint?: FlexLinkIntent | 'auto';
}

// Financial documents that use the #fin-doc URL schema
const FINANCIAL_DOCUMENT_DEFINITION_IDS = [
  FLEX_FOLDER_IDS.presupuesto,
  FLEX_FOLDER_IDS.presupuestoDryHire,
  FLEX_FOLDER_IDS.hojaGastos,
  FLEX_FOLDER_IDS.ordenCompra,
  FLEX_FOLDER_IDS.ordenSubalquiler,
  FLEX_FOLDER_IDS.ordenTrabajo,
];

// Crew call/contact list documents
const CREW_CALL_DEFINITION_IDS = [
  FLEX_FOLDER_IDS.crewCall,
];

// Equipment list documents (pull sheets)
const EQUIPMENT_LIST_DEFINITION_IDS = [
  FLEX_FOLDER_IDS.pullSheet,
];

// Simple element definitions (folders, subfolders)
const SIMPLE_ELEMENT_DEFINITION_IDS = [
  FLEX_FOLDER_IDS.mainFolder,
  FLEX_FOLDER_IDS.subFolder,
];

/**
 * Detects the appropriate Flex link intent based on available context
 * 
 * Priority order:
 * 1. Explicit viewHint (if not 'auto')
 * 2. definitionId mapping
 * 3. domainId hints
 * 4. jobType/folderType hints
 * 5. Default to 'simple-element'
 */
export function detectFlexLinkIntent(context?: IntentDetectionContext): FlexLinkIntent {
  // No context means simple element
  if (!context) {
    return 'simple-element';
  }

  // Explicit view hint takes highest priority
  if (context.viewHint && context.viewHint !== 'auto') {
    return context.viewHint;
  }

  // Check definitionId
  if (context.definitionId) {
    if (CREW_CALL_DEFINITION_IDS.includes(context.definitionId)) {
      return 'contact-list';
    }
    
    if (EQUIPMENT_LIST_DEFINITION_IDS.includes(context.definitionId)) {
      return 'equipment-list';
    }
    
    if (FINANCIAL_DOCUMENT_DEFINITION_IDS.includes(context.definitionId)) {
      return 'fin-doc';
    }
    
    if (SIMPLE_ELEMENT_DEFINITION_IDS.includes(context.definitionId)) {
      return 'simple-element';
    }
  }

  // Check domainId from tree API
  if (context.domainId === 'simple-project-element') {
    return 'simple-element';
  }

  // Check jobType/folderType hints for dryhire/tourdate
  if (
    context.folderType === 'dryhire' ||
    context.folderType === 'tourdate' ||
    context.jobType === 'dryhire' ||
    context.jobType === 'tourdate'
  ) {
    return 'simple-element';
  }

  // Default to simple element
  return 'simple-element';
}

/**
 * Determines if a definitionId is a financial document
 */
export function isFinancialDocument(definitionId?: string): boolean {
  if (!definitionId) return false;
  return FINANCIAL_DOCUMENT_DEFINITION_IDS.includes(definitionId);
}

/**
 * Determines if a definitionId is a crew call/contact list
 */
export function isCrewCall(definitionId?: string): boolean {
  if (!definitionId) return false;
  return CREW_CALL_DEFINITION_IDS.includes(definitionId);
}

/**
 * Determines if a definitionId is an equipment list/pull sheet
 */
export function isEquipmentList(definitionId?: string): boolean {
  if (!definitionId) return false;
  return EQUIPMENT_LIST_DEFINITION_IDS.includes(definitionId);
}

/**
 * Determines if a definitionId is a simple folder/subfolder
 */
export function isSimpleFolder(definitionId?: string): boolean {
  if (!definitionId) return false;
  return SIMPLE_ELEMENT_DEFINITION_IDS.includes(definitionId);
}

/**
 * Determines if a domainId indicates a simple project element
 */
export function isSimpleProjectElement(domainId?: string): boolean {
  if (!domainId) return false;
  return domainId === 'simple-project-element';
}
