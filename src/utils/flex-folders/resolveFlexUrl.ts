import { buildFlexUrl, buildFlexUrlWithTypeDetection, ElementContext } from './buildFlexUrl';
import { supabase } from '@/lib/supabase';
import { detectFlexLinkIntent, IntentDetectionContext } from './intentDetection';
import { buildFlexUrlByIntent } from './urlBuilder';

export interface ResolveFlexUrlOptions {
  elementId: string;
  context?: IntentDetectionContext & {
    displayName?: string;
    documentNumber?: string;
  };
}

/**
 * Resolve a Flex URL synchronously when sufficient context is known.
 * Uses deterministic schema mapping without any network calls.
 * Returns null if the elementId is invalid.
 */
export function resolveFlexUrlSync(options: ResolveFlexUrlOptions): string | null {
  const { elementId, context } = options;

  // Validate elementId
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    console.error('[resolveFlexUrlSync] Invalid elementId:', {
      elementId,
      type: typeof elementId,
    });
    return null;
  }

  try {
    // Detect the intent using shared detection logic
    const intent = detectFlexLinkIntent(context);
    const url = buildFlexUrlByIntent(intent, elementId);

    console.log('[resolveFlexUrlSync] Resolved URL (sync):', {
      url,
      elementId,
      intent,
      context,
    });

    return url;
  } catch (err) {
    console.error('[resolveFlexUrlSync] Failed to build URL:', err);
    return null;
  }
}

/**
 * Resolve a Flex URL, performing type detection via the Flex API when necessary.
 * Falls back to simple-element URL when resolution fails. Returns null only when
 * elementId is invalid.
 */
export async function resolveFlexUrl(options: ResolveFlexUrlOptions): Promise<string | null> {
  const { elementId, context } = options;

  // Validate elementId
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    console.error('[resolveFlexUrl] Invalid elementId:', {
      elementId,
      type: typeof elementId,
    });
    return null;
  }

  try {
    // Optimization: only skip API when context provides strong, unambiguous hints
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
      const intent = detectFlexLinkIntent(context);
      const url = buildFlexUrlByIntent(intent, elementId);
      console.log('[resolveFlexUrl] Resolved URL using context (no API):', {
        url,
        elementId,
        intent,
        context,
      });
      return url;
    }

    // Fetch auth token via Supabase Function
    const { data, error } = await supabase.functions.invoke('get-secret', {
      body: { secretName: 'X_AUTH_TOKEN' },
    });

    if (error) {
      console.warn('[resolveFlexUrl] Failed to fetch auth token, using fallback simple-element URL:', error);
      // Fallback: simple-element URL
      const fallbackUrl = buildFlexUrl(elementId);
      return fallbackUrl;
    }

    const X_AUTH_TOKEN = (data as { X_AUTH_TOKEN?: string } | null)?.X_AUTH_TOKEN || '';

    // If token is missing, fallback to simple-element URL
    if (!X_AUTH_TOKEN) {
      console.warn('[resolveFlexUrl] Missing auth token, using fallback simple-element URL');
      return buildFlexUrl(elementId);
    }

    // Use the async type detection when token is available
    const url = await buildFlexUrlWithTypeDetection(elementId, X_AUTH_TOKEN, context);
    console.log('[resolveFlexUrl] Resolved URL via API detection:', {
      url,
      elementId,
      context,
      schema: url.includes('#fin-doc/') ? 'fin-doc' : 'simple-element',
    });
    return url;
  } catch (err) {
    console.error('[resolveFlexUrl] Error while resolving URL, using fallback simple-element URL:', err);
    try {
      return buildFlexUrl(elementId);
    } catch (e) {
      console.error('[resolveFlexUrl] Fallback URL build failed:', e);
      return null;
    }
  }
}
