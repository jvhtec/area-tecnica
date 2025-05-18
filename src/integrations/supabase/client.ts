
// Import the unified client from the canonical location
import { supabase as baseClient } from '@/lib/supabase-client';
import type { Database } from './types';

/**
 * Main Supabase client with type support
 * This is a typed wrapper around the unified client instance
 */
export const supabase = baseClient as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>;

// Re-export any other utility functions from the base client as needed
export { checkNetworkConnection, getRealtimeConnectionStatus, ensureRealtimeConnection } from '@/lib/enhanced-supabase-client';
