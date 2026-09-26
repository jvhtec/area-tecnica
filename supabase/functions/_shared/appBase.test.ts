import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CANONICAL_APP_BASE, pickConfiguredAppBase, resolveConfiguredAppBase, toSafeOrigin } from "./appBase";

// appBase.ts runs under the Deno edge runtime in production and reads
// Deno.env.get(...) directly; under vitest/Node there is no global Deno, so
// tests stub a minimal one scoped to each test and restore it afterward.
const ENV_KEYS = [
  "PUBLIC_APP_URL",
  "PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "PUBLIC_CONFIRM_BASE",
  "SUPABASE_URL",
] as const;

let env: Record<string, string | undefined>;
let originalDeno: unknown;

beforeEach(() => {
  env = {};
  originalDeno = (globalThis as Record<string, unknown>).Deno;
  (globalThis as Record<string, unknown>).Deno = {
    env: { get: (key: string) => env[key] },
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).Deno = originalDeno;
});

const setEnv = (overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>) => {
  for (const key of ENV_KEYS) env[key] = overrides[key];
};

describe("toSafeOrigin", () => {
  it("normalizes a bare host to an https origin", () => {
    expect(toSafeOrigin("sector-pro.work")).toBe("https://sector-pro.work");
  });

  it("strips path/query from a full URL down to the origin", () => {
    expect(toSafeOrigin("https://sector-pro.work/conductor?x=1")).toBe("https://sector-pro.work");
  });

  it("rejects the retired lovable.app preview domain", () => {
    expect(toSafeOrigin("https://area-tecnica.lovable.app")).toBeNull();
  });

  it("rejects a Supabase project URL regardless of SUPABASE_URL being configured", () => {
    expect(toSafeOrigin("https://syldobdcdsgfgjtbuwxm.supabase.co")).toBeNull();
    expect(toSafeOrigin("syldobdcdsgfgjtbuwxm.supabase.co")).toBeNull();
  });

  it("rejects a self-hosted Supabase URL that matches the configured SUPABASE_URL host", () => {
    env.SUPABASE_URL = "https://api.internal.example.com";
    expect(toSafeOrigin("https://api.internal.example.com")).toBeNull();
    // A different host on the same self-hosted domain is not the API and stays valid.
    expect(toSafeOrigin("https://app.internal.example.com")).toBe("https://app.internal.example.com");
  });

  it("returns null for empty or unparsable input", () => {
    expect(toSafeOrigin(undefined)).toBeNull();
    expect(toSafeOrigin("")).toBeNull();
    expect(toSafeOrigin("   ")).toBeNull();
    expect(toSafeOrigin("not a url::")).toBeNull();
  });
});

describe("resolveConfiguredAppBase", () => {
  it("returns undefined when nothing is configured", () => {
    setEnv({});
    expect(resolveConfiguredAppBase()).toBeUndefined();
  });

  it("uses the first valid candidate in priority order", () => {
    setEnv({ PUBLIC_SITE_URL: "https://second.example.com", SITE_URL: "https://fourth.example.com" });
    expect(resolveConfiguredAppBase()).toBe("https://second.example.com");
  });

  it("skips a deprecated candidate and falls through to the next one", () => {
    setEnv({
      PUBLIC_APP_URL: "https://area-tecnica.lovable.app",
      PUBLIC_SITE_URL: "https://sector-pro.work",
    });
    expect(resolveConfiguredAppBase()).toBe("https://sector-pro.work");
  });

  it("skips a Supabase-project candidate and falls through to the next one", () => {
    setEnv({
      PUBLIC_APP_URL: "https://syldobdcdsgfgjtbuwxm.supabase.co",
      SITE_URL: "https://sector-pro.work",
    });
    expect(resolveConfiguredAppBase()).toBe("https://sector-pro.work");
  });

  it("returns undefined when every configured candidate is invalid", () => {
    setEnv({
      PUBLIC_APP_URL: "https://area-tecnica.lovable.app",
      SITE_URL: "https://syldobdcdsgfgjtbuwxm.supabase.co",
    });
    expect(resolveConfiguredAppBase()).toBeUndefined();
  });
});

describe("pickConfiguredAppBase", () => {
  it("falls back to the canonical production origin when nothing is configured", () => {
    setEnv({});
    expect(pickConfiguredAppBase()).toBe(CANONICAL_APP_BASE);
  });

  it("falls back to the canonical origin when the only candidate is the Supabase project URL", () => {
    // This is the exact production incident this module exists to prevent:
    // a PUBLIC_APP_URL-style secret pointing at the backend instead of the app.
    setEnv({ PUBLIC_APP_URL: "https://syldobdcdsgfgjtbuwxm.supabase.co" });
    expect(pickConfiguredAppBase()).toBe(CANONICAL_APP_BASE);
  });

  it("prefers a valid configured candidate over the canonical default", () => {
    setEnv({ SITE_URL: "https://preview.example.com" });
    expect(pickConfiguredAppBase()).toBe("https://preview.example.com");
  });
});
