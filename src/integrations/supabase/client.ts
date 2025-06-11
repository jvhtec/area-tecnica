
// Import the unified client from the canonical location
import { supabase as baseClient } from '@/lib/supabase-client';
import type { Database } from './types';

/**
 * Main Supabase client with type support
 * This is a typed wrapper around the unified client instance
 */
export const supabase = baseClient as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>;

// Re-export utility functions from all client modules
export { 
  checkNetworkConnection, 
  getRealtimeConnectionStatus 
} from '@/lib/supabase-client';

export { 
  ensureRealtimeConnection,
  monitorConnectionHealth,
  forceRefreshSubscriptions 
} from '@/lib/enhanced-supabase-client';
