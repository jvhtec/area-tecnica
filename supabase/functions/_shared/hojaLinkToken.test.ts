import { describe, expect, it } from "vitest";

import {
  buildJobHojaLinkUrl,
  computeJobHojaLinkExpiry,
  getJobHojaLinkSecret,
  resolveJobHojaLinkTtlSeconds,
  signJobHojaLink,
  verifyJobHojaLink,
} from "./hojaLinkToken.ts";

describe("Hoja de Ruta stable link tokens", () => {
  it("signs and verifies a job-scoped expiring link token", async () => {
    const expiresAt = 1_800_000_000;
    const token = await signJobHojaLink({
      jobId: "job-1",
      expiresAt,
      secret: "secret-1",
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    await expect(verifyJobHojaLink({
      jobId: "job-1",
      expiresAt,
      token,
      secret: "secret-1",
      nowSeconds: expiresAt - 60,
    })).resolves.toBe(true);
  });

  it("rejects tampered, expired, and unsigned link tokens", async () => {
    const expiresAt = 1_800_000_000;
    const token = await signJobHojaLink({
      jobId: "job-1",
      expiresAt,
      secret: "secret-1",
    });

    await expect(verifyJobHojaLink({
      jobId: "job-2",
      expiresAt,
      token,
      secret: "secret-1",
      nowSeconds: expiresAt - 60,
    })).resolves.toBe(false);

    await expect(verifyJobHojaLink({
      jobId: "job-1",
      expiresAt,
      token,
      secret: "secret-1",
      nowSeconds: expiresAt,
    })).resolves.toBe(false);

    await expect(verifyJobHojaLink({
      jobId: "job-1",
      expiresAt,
      token,
      secret: "",
      nowSeconds: expiresAt - 60,
    })).resolves.toBe(false);
  });

  it("builds a sibling Edge Function URL without preserving stale query state", async () => {
    const url = buildJobHojaLinkUrl({
      requestUrl: "https://project.supabase.co/functions/v1/send-job-whatsapp-message?old=true",
      jobId: " job-1 ",
      expiresAt: 1_800_000_000,
      token: "token-1",
    });

    expect(url).toBe(
      "https://project.supabase.co/functions/v1/job-hoja-de-ruta-link?job_id=job-1&exp=1800000000&t=token-1",
    );
  });

  it("builds the resolver as a sibling when the source function URL has a trailing slash", () => {
    const url = buildJobHojaLinkUrl({
      requestUrl: "https://project.supabase.co/functions/v1/send-job-whatsapp-message/",
      jobId: "job-1",
      expiresAt: 1_800_000_000,
      token: "token-1",
    });

    expect(url).toBe(
      "https://project.supabase.co/functions/v1/job-hoja-de-ruta-link?job_id=job-1&exp=1800000000&t=token-1",
    );
  });

  it("uses a long-lived but bounded default ttl that can be configured", () => {
    expect(computeJobHojaLinkExpiry(100, 60)).toBe(160);
    expect(resolveJobHojaLinkTtlSeconds(() => undefined)).toBe(60 * 60 * 24 * 365);
    expect(resolveJobHojaLinkTtlSeconds((name) => name === "JOB_HOJA_LINK_TTL_SECONDS" ? "3600" : undefined)).toBe(3600);
    expect(resolveJobHojaLinkTtlSeconds((name) => name === "JOB_HOJA_LINK_TTL_SECONDS" ? "10" : undefined)).toBe(60);
  });

  it("prefers explicit Hoja link secrets before falling back to service role", () => {
    expect(getJobHojaLinkSecret((name) => ({
      JOB_HOJA_LINK_SECRET: "job-secret",
      HOJA_DE_RUTA_LINK_SECRET: "hoja-secret",
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
    })[name])).toBe("job-secret");

    expect(getJobHojaLinkSecret((name) => ({
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
    })[name])).toBe("service-secret");
  });
});
