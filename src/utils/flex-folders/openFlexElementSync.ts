import { resolveFlexUrlSync } from './resolveFlexUrl';
import { toast as showToast } from 'sonner';

export interface OpenFlexElementSyncOptions {
  elementId: string;
  /**
   * Domain ID from Flex tree API (e.g., "simple-project-element")
   */
  domainId?: string;
  /**
   * Definition ID from Flex tree API to determine element type
   */
  definitionId?: string;
  /**
   * Display name for better error messages
   */
  displayName?: string;
  /**
   * Document number for better error messages
   */
  documentNumber?: string;
}

const FLEX_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop';

/**
 * Opens a Flex element synchronously in a new tab without using window.open().
 * This approach bypasses pop-up blockers by using a programmatic anchor click.
 * 
 * IMPORTANT: This function is SYNCHRONOUS and must be called directly in a user event handler
 * to preserve the user gesture and avoid pop-up blocking.
 * 
 * @param options - Configuration for opening the Flex element
 */
export function openFlexElementSync(options: OpenFlexElementSyncOptions): void {
  const { elementId, domainId, definitionId, displayName, documentNumber } = options;

  console.log('[openFlexElementSync] Starting synchronous navigation', {
    elementId,
    elementIdType: typeof elementId,
    elementIdValue: elementId,
    elementIdEmpty: !elementId,
    elementIdLength: elementId?.length || 0,
    domainId,
    definitionId,
    displayName,
    documentNumber,
  });

  // Guard: Validate elementId is present and non-empty
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = `Invalid element ID: "${elementId}". Cannot navigate to Flex without a valid element identifier.`;
    console.error('[openFlexElementSync] Invalid element ID:', {
      elementId,
      type: typeof elementId,
      isEmpty: elementId === '',
      isNull: elementId === null,
      isUndefined: elementId === undefined,
      options,
    });
    
    showToast.error('Invalid element ID received. Please check the element data.');
    return;
  }

  try {
    // Resolve URL synchronously using available context
    console.log('[openFlexElementSync] Resolving Flex URL synchronously via resolver');
    const url = resolveFlexUrlSync({ elementId, context: { definitionId, domainId } });

    console.log('[openFlexElementSync] URL resolved:', {
      url,
      urlType: typeof url,
      urlNull: url === null,
      urlUndefined: url === undefined,
      urlEmpty: url === '',
      elementId,
      urlLength: url?.length || 0,
      hasValidUrl: url ? url.includes(elementId) : false,
    });

    // Guard: Verify URL is valid before navigating
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      const error = `resolveFlexUrlSync returned invalid URL: "${url}" (type: ${typeof url})`;
      console.error('[openFlexElementSync]', error, {
        elementId,
        domainId,
        definitionId,
        url,
      });
      
      showToast.error(`Failed to construct URL for element${displayName ? ` "${displayName}"` : ''}`);
      return;
    }

    // Guard: Verify URL starts with expected base
    if (!url.startsWith(FLEX_BASE_URL)) {
      console.warn('[openFlexElementSync] URL does not start with expected base:', {
        url,
        expectedBase: FLEX_BASE_URL,
        elementId,
      });
    }

    // Navigate using programmatic anchor click (bypasses pop-up blockers)
    console.log('[openFlexElementSync] Creating programmatic anchor for navigation');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    
    // Make anchor invisible
    anchor.style.display = 'none';
    
    // Append to DOM
    document.body.appendChild(anchor);
    
    console.log('[openFlexElementSync] Clicking anchor element');
    anchor.click();
    
    // Clean up immediately (synchronously)
    document.body.removeChild(anchor);
    
    console.log('[openFlexElementSync] Navigation completed successfully', {
      url,
      elementId,
      displayName,
      documentNumber,
    });

  } catch (error) {
    console.error('[openFlexElementSync] Error during navigation:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      elementId,
      domainId,
      definitionId,
      displayName,
      documentNumber,
    });

    // Attempt fallback URL construction
    try {
      const fallbackUrl = `${FLEX_BASE_URL}#element/${elementId}/view/simple-element/header`;
      console.log('[openFlexElementSync] Attempting fallback URL:', {
        fallbackUrl,
        elementId,
        errorType: error instanceof Error ? error.name : typeof error,
      });

      const anchor = document.createElement('a');
      anchor.href = fallbackUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      console.log('[openFlexElementSync] Fallback navigation succeeded');
      
      showToast.warning('Opened with fallback URL using simple element format.');

    } catch (fallbackError) {
      console.error('[openFlexElementSync] Fallback navigation also failed:', {
        fallbackError,
        originalError: error,
        elementId,
      });

      showToast.error(
        `Failed to open Flex element: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`
      );
    }
  }
}
