
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/api-config';
import type { Database } from './types';

/**
 * Main Supabase client with type support
 * This exports the same instance as src/lib/supabase-client.ts but with types
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
