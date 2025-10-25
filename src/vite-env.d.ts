/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_ENABLE_GPTENG?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_FLEX_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
