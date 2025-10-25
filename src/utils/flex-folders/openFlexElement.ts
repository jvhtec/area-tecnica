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
    context,
    jobType: context?.jobType,
    folderType: context?.folderType,
  });

  // Guard: Validate elementId is present and non-empty
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    const error = new Error(`Invalid element ID: "${elementId}". Cannot navigate to Flex without a valid element identifier.`);
    console.error('[openFlexElement] Invalid element ID:', { elementId, type: typeof elementId });
    if (onError) {
      onError(error);
    }
    return;
  }

  // Step 1: Open a placeholder window synchronously to preserve user gesture
  // This prevents pop-up blockers from interfering
  const placeholderWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');

  if (!placeholderWindow) {
    // Pop-up was blocked even with synchronous call
    const error = new Error('Pop-up blocked. Please allow pop-ups for this site.');
    console.error('[openFlexElement] Pop-up blocked:', error);
    if (onError) {
      onError(error);
    }
    return;
  }

  try {
    // Step 2: Fetch the auth token asynchronously
    console.log('[openFlexElement] Fetching auth token for element:', elementId);
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
      });
      
      placeholderWindow.location.href = fallbackUrl;
      
      if (onWarning) {
        onWarning('Opened with fallback URL format (authentication failed)');
      }
      return;
    }

    console.log('[openFlexElement] Auth token fetched successfully, token length:', X_AUTH_TOKEN.length);

    // Step 3: Build URL with element type detection
    console.log('[openFlexElement] Building URL with type detection...', {
      elementId,
      hasContext: !!context,
      contextJobType: context?.jobType,
      contextFolderType: context?.folderType,
      contextDefinitionId: context?.definitionId,
    });
    
    const flexUrl = await buildFlexUrlWithTypeDetection(
      elementId,
      X_AUTH_TOKEN,
      context
    );
    
    console.log('[openFlexElement] Successfully built Flex URL:', {
      url: flexUrl,
      elementId,
      urlLength: flexUrl.length,
      hasValidUrl: flexUrl.includes(elementId),
    });
    
    // Guard: Verify URL is valid before navigating
    if (!flexUrl || typeof flexUrl !== 'string' || flexUrl.trim().length === 0) {
      throw new Error(`buildFlexUrlWithTypeDetection returned invalid URL: "${flexUrl}"`);
    }
    
    // Step 4: Update the placeholder window's location
    placeholderWindow.location.href = flexUrl;
    console.log('[openFlexElement] Placeholder window location updated successfully');
    
  } catch (error) {
    console.error('[openFlexElement] Error during navigation:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      elementId,
      context,
    });
    
    // Final fallback: use simple element URL
    const fallbackUrl = `${FLEX_BASE_URL}#element/${elementId}/view/simple-element/header`;
    console.log('[openFlexElement] Attempting fallback URL after error:', {
      fallbackUrl,
      elementId,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    
    try {
      placeholderWindow.location.href = fallbackUrl;
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
      });
      
      try {
        placeholderWindow.close();
        console.log('[openFlexElement] Placeholder window closed due to fatal error');
      } catch (closeError) {
        console.error('[openFlexElement] Failed to close placeholder window:', closeError);
      }
      
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error during navigation'));
      }
    }
  }
}
