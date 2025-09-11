
// Re-export the unified client from the canonical path
export { 
  supabase, 
  checkNetworkConnection, 
  getRealtimeConnectionStatus 
} from './supabase-client';

export { 
  ensureRealtimeConnection,
  monitorConnectionHealth,
  forceRefreshSubscriptions
} from './enhanced-supabase-client';
