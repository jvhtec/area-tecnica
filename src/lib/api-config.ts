
// Supabase configuration is injected via Vite env vars.
// Falls back to VITE_SUPABASE_PUBLISHABLE_KEY for compatibility.
const requireEnv = (name: string, value: string | undefined) => {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const SUPABASE_URL = requireEnv(
  'VITE_SUPABASE_URL',
  import.meta.env.VITE_SUPABASE_URL as string | undefined
);

export const SUPABASE_ANON_KEY = requireEnv(
  'VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)',
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as
    | string
    | undefined
);

// Base URLs for different APIs (keep as-is; not secret)
export const FLEX_API_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/api';
