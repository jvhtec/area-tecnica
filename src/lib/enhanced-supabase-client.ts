
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './api-config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: localStorage,
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
 * Checks if we have a network connection by using a simple fetch
 * to the Supabase health endpoint
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
 * Returns the current state of the Supabase WebSocket connection
 */
export const getRealtimeConnectionStatus = (): 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' => {
  const channels = supabase.getChannels();
  
  if (channels.length === 0) {
    return 'DISCONNECTED';
  }
  
  // Check if any channel is connected
  const hasConnected = channels.some(channel => 
    channel.state === 'joined' || 
    channel.state === 'joined'
  );
  
  if (hasConnected) {
    return 'CONNECTED';
  }
  
  return 'CONNECTING';
};
