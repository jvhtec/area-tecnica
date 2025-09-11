
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/api-config';
import type { Database } from './types';

/**
 * Main Supabase client with simplified configuration
 * Single source of truth for all Supabase operations
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});

/**
 * Checks network connection to Supabase
 */
export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/health`, {
      method: 'HEAD',
      headers: { 'Cache-Control': 'no-cache' },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

/**
 * Returns the current realtime connection status
 */
export const getRealtimeConnectionStatus = (): 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' => {
  const channels = supabase.getChannels();
  
  if (channels.length === 0) {
    return 'DISCONNECTED';
  }
  
  const hasConnected = channels.some(channel => channel.state === 'joined');
  
  if (hasConnected) {
    return 'CONNECTED';
  }
  
  return 'CONNECTING';
};
