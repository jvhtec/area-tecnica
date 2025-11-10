import { resolveFlexUrl, resolveFlexUrlSync } from './resolveFlexUrl';
import { getFlexBaseUrl } from './config';
import { IntentDetectionContext } from './intentDetection';
import { buildFlexUrlByIntent } from './urlBuilder';

export interface OpenFlexElementOptions {
  elementId: string;
  /**
   * Optional context about the element to avoid extra API calls
   */
  context?: IntentDetectionContext;
  /**
   * Optional callback for error handling
   */
  onError?: (error: Error) => void;
  /**
   * Optional callback for warnings (e.g., when using fallback URL)
   */
  onWarning?: (message: string) => void;
}

/**
 * Opens a Flex element in a new tab, handling URL resolution while preserving user gesture.
 * Uses synchronous resolution when sufficient context is provided (e.g., from tree navigation).
 * Falls back to async resolution with API calls when context is insufficient.
 */
export async function openFlexElement(options: OpenFlexElementOptions): Promise<void> {
  const { elementId, context, onError, onWarning } = options;

  console.log('[openFlexElement] Starting navigation', { 
    elementId, 
    elementIdType: typeof elementId,
    elementIdEmpty: !elementId,
    elementIdValue: elementId,
    elementIdLength: elementId?.length || 0,
    context,
    jobType: context?.jobType,
    folderType: context?.folderType,
    domainId: context?.domainId,
    definitionId: context?.definitionId,
    schemaId: context?.schemaId,
  });

  // Guard: Validate elementId is present and non-empty
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = new Error(`Invalid element ID: "${elementId}". Cannot navigate to Flex without a valid element identifier.`);
    console.error('[openFlexElement] Invalid element ID:', { 
      elementId, 
      type: typeof elementId,
      isEmpty: elementId === '',
      isNull: elementId === null,
      isUndefined: elementId === undefined,
    });
    if (onError) {
      onError(error);
    }
    return;
  }

  // OPTIMIZATION: Use synchronous navigation when sufficient context is available
  // This is the case for tree navigation, where we already have all the metadata
  const hasSchemaId = typeof context?.schemaId === 'string' && context.schemaId.trim().length > 0;
  const hasSufficientContext = !!(
    context?.domainId ||
    context?.definitionId ||
    (context?.viewHint && context.viewHint !== 'auto') ||
    hasSchemaId
  );

  if (hasSufficientContext) {
    console.log('[openFlexElement] Using synchronous navigation path (sufficient context)', {
      elementId,
      context,
      hasDomainId: !!context?.domainId,
      hasDefinitionId: !!context?.definitionId,
      hasViewHint: !!context?.viewHint,
      hasSchemaId,
    });

    try {
      const url = resolveFlexUrlSync({ elementId, context });
      
      if (url) {
        console.log('[openFlexElement] Successfully resolved URL synchronously:', { url, elementId });
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      
      console.warn('[openFlexElement] Sync resolution returned null, falling back to async path');
    } catch (syncError) {
      console.warn('[openFlexElement] Sync resolution failed, falling back to async path:', syncError);
    }
  }

  // ASYNC PATH: Used when context is insufficient or sync resolution failed
  console.log('[openFlexElement] Using async navigation path', {
    elementId,
    hasSufficientContext,
    reason: hasSufficientContext ? 'sync failed' : 'insufficient context',
    hasSchemaId,
  });

  // Step 1: Try to open a placeholder window synchronously to preserve user gesture
  let placeholderWindow: Window | null = null;
  let useAlternativeMethod = false;
  
  try {
    // Open a controllable placeholder window and manually drop the opener to avoid leaks.
    // Avoid 'noopener' feature to ensure Safari returns a window handle we can navigate.
    placeholderWindow = window.open('', '_blank');
    if (placeholderWindow) {
      try {
        // Manually nullify opener to replicate 'noopener' behavior
        (placeholderWindow as any).opener = null;
        // Ensure it starts blank (some browsers may reuse content)
        placeholderWindow.location.href = 'about:blank';
      } catch (noop) {
        // Ignore errors; we'll still attempt to navigate later
      }
    }
    console.log('[openFlexElement] Placeholder window opened:', { 
      success: !!placeholderWindow,
      windowType: typeof placeholderWindow,
    });
  } catch (openError) {
    console.warn('[openFlexElement] window.open threw error, will use alternative method:', openError);
    useAlternativeMethod = true;
  }

  if (!placeholderWindow || useAlternativeMethod) {
    // Pop-up was blocked or error occurred - use alternative link click method
    console.warn('[openFlexElement] Placeholder window blocked or failed, using link click method');
    useAlternativeMethod = true;
  }

  try {
    // Resolve the final URL using the shared resolver (handles token + type detection)
    console.log('[openFlexElement] Resolving final URL via resolver...', { elementId, context });
    const resolvedUrl = await resolveFlexUrl({ elementId, context });

    if (!resolvedUrl || typeof resolvedUrl !== 'string' || resolvedUrl.trim().length === 0) {
      // Fallback to simple element URL if resolver failed
      const fallbackUrl = buildFlexUrlByIntent('simple-element', elementId);
      console.log('[openFlexElement] Resolver returned empty, using fallback URL:', {
        fallbackUrl,
        elementId,
        useAlternativeMethod,
      });

      if (useAlternativeMethod) {
        try {
          if (placeholderWindow) {
            placeholderWindow.close();
          }
        } catch {}
        navigateWithLinkClick(fallbackUrl);
      } else {
        placeholderWindow!.location.href = fallbackUrl;
      }

      if (onWarning) {
        onWarning('Opened with fallback URL format (resolver failed)');
      }
      return;
    }

    console.log('[openFlexElement] Successfully resolved URL:', {
      url: resolvedUrl,
      method: useAlternativeMethod ? 'link-click' : 'placeholder-window',
    });

    // Navigate using the appropriate method
    if (useAlternativeMethod) {
      try {
        if (placeholderWindow) {
          placeholderWindow.close();
        }
      } catch {}
      navigateWithLinkClick(resolvedUrl);
    } else {
      placeholderWindow!.location.href = resolvedUrl;
    }

    console.log('[openFlexElement] Navigation completed successfully');

  } catch (error) {
    console.error('[openFlexElement] Error during navigation:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      elementId,
      context,
      useAlternativeMethod,
    });
    
    // Final fallback: use simple element URL
    const fallbackUrl = buildFlexUrlByIntent('simple-element', elementId);
    console.log('[openFlexElement] Attempting fallback URL after error:', {
      fallbackUrl,
      elementId,
      errorType: error instanceof Error ? error.name : typeof error,
      useAlternativeMethod,
    });
    
    try {
      if (useAlternativeMethod) {
        navigateWithLinkClick(fallbackUrl);
      } else {
        placeholderWindow!.location.href = fallbackUrl;
      }
      console.log('[openFlexElement] Fallback URL set successfully');
      
      if (onWarning) {
        onWarning('Opened with fallback URL format (error occurred)');
      }
    } catch (windowError) {
      // If we can't even set the location, close the window and report error
      console.error('[openFlexElement] Failed to set window location on fallback:', {
        windowError,
        originalError: error,
        elementId,
        fallbackUrl,
        useAlternativeMethod,
      });
      
      if (!useAlternativeMethod && placeholderWindow) {
        try {
          placeholderWindow.close();
          console.log('[openFlexElement] Placeholder window closed due to fatal error');
        } catch (closeError) {
          console.error('[openFlexElement] Failed to close placeholder window:', closeError);
        }
      }
      
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error during navigation'));
      }
    }
  }
}

/**
 * Helper function to navigate using the link click method
 * This bypasses popup blockers by programmatically clicking a link element
 */
function navigateWithLinkClick(url: string): void {
  console.log('[openFlexElement] Creating programmatic link for navigation:', url);
  
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  
  // Style the link to be invisible
  link.style.display = 'none';
  
  document.body.appendChild(link);
  
  console.log('[openFlexElement] Clicking programmatic link');
  link.click();
  
  // Clean up after a short delay
  setTimeout(() => {
    document.body.removeChild(link);
    console.log('[openFlexElement] Programmatic link removed');
  }, 100);
}
