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

declare module "file-saver" {
  export function saveAs(
    data: Blob | File | string,
    filename?: string,
    options?: { autoBom?: boolean }
  ): void;
}

declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions
  ): Promise<string>;
}
