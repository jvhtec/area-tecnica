import { supabase } from '@/lib/supabase';
import { buildFlexUrlWithTypeDetection } from './buildFlexUrl';

export interface OpenFlexElementOptions {
  elementId: string;
  /**
   * Optional context about the element to avoid extra API calls
   */
  context?: {
    jobType?: 'single' | 'festival' | 'dryhire' | 'tourdate';
    folderType?: 'main' | 'dryhire' | 'tourdate';
    definitionId?: string;
    domainId?: string;
  };
  /**
   * Optional callback for error handling
   */
  onError?: (error: Error) => void;
  /**
   * Optional callback for warnings (e.g., when using fallback URL)
   */
  onWarning?: (message: string) => void;
}

const FLEX_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop';

/**
 * Opens a Flex element in a new tab, handling the async token fetch and URL building
 * while preserving the user gesture to avoid pop-up blocking.
 * 
 * This utility:
 * 1. Opens a placeholder window synchronously (preserves user gesture)
 * 2. Fetches the auth token asynchronously
 * 3. Builds the final URL with type detection
 * 4. Updates the placeholder window's location
 * 5. Handles errors gracefully with fallbacks
 * 
 * @param options - Configuration for opening the Flex element
 * @returns Promise that resolves when the operation completes
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

  // Step 1: Try to open a placeholder window synchronously to preserve user gesture
  // This prevents pop-up blockers from interfering
  let placeholderWindow: Window | null = null;
  let useAlternativeMethod = false;
  
  try {
    placeholderWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');
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
    // Step 2: Fetch the auth token asynchronously
    console.log('[openFlexElement] Fetching auth token for element:', { 
      elementId,
      elementIdValid: !!elementId && elementId.trim().length > 0,
    });
    
    const { data: { X_AUTH_TOKEN }, error: tokenError } = await supabase
      .functions.invoke('get-secret', {
        body: { secretName: 'X_AUTH_TOKEN' }
      });

    if (tokenError || !X_AUTH_TOKEN) {
      console.error('[openFlexElement] Failed to get auth token:', {
        error: tokenError,
        elementId,
        context,
        hasToken: !!X_AUTH_TOKEN,
      });
      
      // Fallback to simple element URL if auth fails
      const fallbackUrl = `${FLEX_BASE_URL}#element/${elementId}/view/simple-element/header`;
      console.log('[openFlexElement] Using fallback URL after auth failure:', {
        fallbackUrl,
        elementId,
        reason: 'Authentication failed',
        useAlternativeMethod,
      });
      
      if (useAlternativeMethod) {
        // Use link click method
        navigateWithLinkClick(fallbackUrl);
      } else {
        placeholderWindow!.location.href = fallbackUrl;
      }
      
      if (onWarning) {
        onWarning('Opened with fallback URL format (authentication failed)');
      }
      return;
    }

    console.log('[openFlexElement] Auth token fetched successfully, token length:', X_AUTH_TOKEN.length);

    // Step 3: Build URL with element type detection
    console.log('[openFlexElement] Building URL with type detection...', {
      elementId,
      elementIdValue: elementId,
      hasContext: !!context,
      contextJobType: context?.jobType,
      contextFolderType: context?.folderType,
      contextDefinitionId: context?.definitionId,
      contextDomainId: context?.domainId,
    });
    
    const flexUrl = await buildFlexUrlWithTypeDetection(
      elementId,
      X_AUTH_TOKEN,
      context
    );
    
    console.log('[openFlexElement] Successfully built Flex URL:', {
      url: flexUrl,
      urlType: typeof flexUrl,
      urlNull: flexUrl === null,
      urlUndefined: flexUrl === undefined,
      urlEmpty: flexUrl === '',
      elementId,
      urlLength: flexUrl?.length || 0,
      hasValidUrl: flexUrl ? flexUrl.includes(elementId) : false,
    });
    
    // Guard: Verify URL is valid before navigating
    if (!flexUrl || typeof flexUrl !== 'string' || flexUrl.trim().length === 0) {
      const error = `buildFlexUrlWithTypeDetection returned invalid URL: "${flexUrl}" (type: ${typeof flexUrl})`;
      console.error('[openFlexElement]', error, {
        elementId,
        context,
        flexUrl,
      });
      throw new Error(error);
    }
    
    // Step 4: Navigate using the appropriate method
    if (useAlternativeMethod) {
      console.log('[openFlexElement] Navigating with link click method');
      navigateWithLinkClick(flexUrl);
    } else {
      console.log('[openFlexElement] Updating placeholder window location');
      placeholderWindow!.location.href = flexUrl;
    }
    
    console.log('[openFlexElement] Navigation completed successfully', {
      method: useAlternativeMethod ? 'link-click' : 'placeholder-window',
      url: flexUrl,
    });
    
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
    const fallbackUrl = `${FLEX_BASE_URL}#element/${elementId}/view/simple-element/header`;
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
