
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './api-config';

/**
 * Unified Supabase client with enhanced configuration
 * - All application code should import from this file
 * - Configured for auth persistence and token refresh
 * - Optimized realtime settings
 */
const getAuthStorage = (): Storage | undefined => {
  // In Node/Vitest (non-jsdom), localStorage doesn’t exist.
  // Avoid crashing at import-time; tests can mock auth explicitly when needed.
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return undefined;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: !!getAuthStorage(),
    detectSessionInUrl: typeof window !== 'undefined',
    flowType: 'pkce',
    storage: getAuthStorage(),
    storageKey: 'supabase.auth.token',
  },
  realtime: {
    params: {
      eventsPerSecond: 1, // Reduce frequency to avoid rate limits
    },
    timeout: 30000, // Increase timeout to 30 seconds (from default 10s)
    heartbeatIntervalMs: 15000, // Send heartbeat every 15 seconds
  },
});

/**
 * Checks if we have a network connection
 * Uses navigator.onLine as primary check (no HTTP requests = no error logs)
 * Falls back to fetch only if navigator.onLine is unreliable
 */
export const checkNetworkConnection = async (): Promise<boolean> => {
  // Primary: use navigator.onLine (instant, no network request, no error logs)
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }

  // Fallback: make a HEAD request (lighter than GET, still may log 401)
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: { 'Cache-Control': 'no-cache' },
    });
    return !!response.status;
  } catch {
    return false;
  }
};

/**
 * Returns the current state of the Supabase WebSocket connection
 */
export const getRealtimeConnectionStatus = (): 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' => {
  const channels = supabase.getChannels();
  
  if (channels.length === 0) {
    return 'DISCONNECTED';
  }
  
  // Check if any channel is connected - using the correct enum value
  const hasConnected = channels.some(channel => {
    return channel.state === 'joined';
  });
  
  if (hasConnected) {
    return 'CONNECTED';
  }
  
  return 'CONNECTING';
};
