// Supabase configuration is injected via Vite env vars.
// In tests (Vitest/Node), we also allow falling back to process.env.
// Falls back to VITE_SUPABASE_PUBLISHABLE_KEY for compatibility.

type EnvSource = Record<string, string | undefined>;

const getEnv = (name: string): string | undefined => {
  const metaEnv = (import.meta as any)?.env as EnvSource | undefined;
  // In Vite client bundles, `process` may be undefined.
  const processEnv = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return metaEnv?.[name] ?? processEnv;
};

const requireEnv = (name: string, value: string | undefined) => {
  if (!value || value.trim() === '') {
    // Vitest runs in Node and does not automatically inject Vite env vars.
    // Provide safe placeholders so modules can import without crashing.
    if (process.env.VITEST || process.env.NODE_ENV === 'test') {
      if (name.includes('VITE_SUPABASE_URL')) return 'http://localhost:54321';
      return 'test-key';
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const SUPABASE_URL = requireEnv('VITE_SUPABASE_URL', getEnv('VITE_SUPABASE_URL'));

export const SUPABASE_ANON_KEY = requireEnv(
  'VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)',
  getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
);

// Base URLs for different APIs (keep as-is; not secret)
export const FLEX_API_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/api';
