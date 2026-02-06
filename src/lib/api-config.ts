// Supabase configuration is injected via Vite env vars.
// IMPORTANT: Vite requires STATIC property access (import.meta.env.VITE_XXX)
// to properly inline values at bundle time. Dynamic access like env[name] won't work.

// Check if we're in a test environment (Vitest)
const isTestEnv =
  typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test');

// Get URL - use static access so Vite can inline the value
const getSupabaseUrl = (): string => {
  // Vite inlines this during dev/build
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (url) return url;
  
  // Fallback for test environment
  if (isTestEnv) return 'http://localhost:54321';
  
  throw new Error('Missing required environment variable: VITE_SUPABASE_URL');
};

// Get anon key - try both names for compatibility
const getSupabaseAnonKey = (): string => {
  // Vite inlines these during dev/build
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (anonKey) return anonKey;
  if (publishableKey) return publishableKey;
  
  // Fallback for test environment
  if (isTestEnv) return 'test-key';
  
  throw new Error('Missing required environment variable: VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)');
};

export const SUPABASE_URL = getSupabaseUrl();
export const SUPABASE_ANON_KEY = getSupabaseAnonKey();

// Base URLs for different APIs (keep as-is; not secret)
export const FLEX_API_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/api';
