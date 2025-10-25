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
 * - simple-element: #element/{id}/view/simple-element/header
 * - fin-doc: #fin-doc/{id}/doc-view/{viewId}/header
 * - contact-list: #contact-list/{id}/view/{viewId}/detail
 * - equipment-list: #equipment-list/{id}/view/simple-element/header
 * - remote-file-list: #remote-file-list/{id}/view/simple-element/header
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
      return `${baseUrl}#element/${elementId}/view/simple-element/header`;

    case 'fin-doc': {
      const finDocViewId = viewId || getFlexViewId('presupuesto');
      return `${baseUrl}#fin-doc/${elementId}/doc-view/${finDocViewId}/header`;
    }

    case 'contact-list': {
      const contactViewId = viewId || getFlexViewId('crewCall');
      return `${baseUrl}#contact-list/${elementId}/view/${contactViewId}/detail`;
    }

    case 'equipment-list':
      return `${baseUrl}#equipment-list/${elementId}/view/simple-element/header`;

    case 'remote-file-list':
      return `${baseUrl}#remote-file-list/${elementId}/view/simple-element/header`;

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = intent;
      console.warn('[urlBuilder] Unknown intent, using simple-element fallback:', intent);
      return `${baseUrl}#element/${elementId}/view/simple-element/header`;
    }
  }
}
