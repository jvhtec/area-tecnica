import { getFlexBaseUrl, getFlexViewId } from './config';
import { FlexLinkIntent } from './intentDetection';

/**
 * Builds a Flex URL based on the intent and element ID
 * 
 * @param intent - The type of Flex link to build
 * @param elementId - The element/document ID
 * @param viewId - Optional custom view ID (uses defaults if not provided)
 * @returns Formatted Flex URL
 * 
 * @remarks
 * This is the core URL builder that all other functions should use.
 * It handles the different URL schemas based on intent:
 * - simple-element: #element/{id}/view/simple-element/detail
 * - fin-doc: #fin-doc/{id}/doc-view/{viewId}/detail
 * - expense-sheet: #fin-doc/{id}/doc-view/{expenseViewId}/detail
 * - contact-list: #contact-list/{id}/view/{crewCallViewId}/detail
 * - equipment-list: #element/{id}/view/equipment-list/detail
 * - remote-file-list: #element/{id}/view/remote-file-list/detail
 */
export function buildFlexUrlByIntent(
  intent: FlexLinkIntent,
  elementId: string,
  viewId?: string
): string {
  // Validate elementId
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = `Invalid elementId provided to buildFlexUrlByIntent: "${elementId}" (type: ${typeof elementId})`;
    console.error('[urlBuilder]', error);
    throw new Error(error);
  }

  const baseUrl = getFlexBaseUrl();

  switch (intent) {
    case 'simple-element':
      return `${baseUrl}#element/${elementId}/view/simple-element/detail`;

    case 'fin-doc': {
      const finDocViewId = viewId || getFlexViewId('presupuesto');
      return `${baseUrl}#fin-doc/${elementId}/doc-view/${finDocViewId}/detail`;
    }

    case 'expense-sheet': {
      const expenseSheetViewId = viewId || getFlexViewId('expenseSheet');
      return `${baseUrl}#fin-doc/${elementId}/doc-view/${expenseSheetViewId}/detail`;
    }

    case 'contact-list': {
      const contactViewId = viewId || getFlexViewId('crewCall');
      return `${baseUrl}#contact-list/${elementId}/view/${contactViewId}/detail`;
    }

    case 'equipment-list': {
      const equipmentViewName = viewId || 'equipment-list';
      return `${baseUrl}#element/${elementId}/view/${equipmentViewName}/detail`;
    }

    case 'remote-file-list': {
      const remoteFileViewName = viewId || 'remote-file-list';
      return `${baseUrl}#element/${elementId}/view/${remoteFileViewName}/detail`;
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = intent;
      console.warn('[urlBuilder] Unknown intent, using simple-element fallback:', intent);
      return `${baseUrl}#element/${elementId}/view/simple-element/detail`;
    }
  }
}
