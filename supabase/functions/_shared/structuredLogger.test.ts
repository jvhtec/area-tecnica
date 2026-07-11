import { describe, expect, it } from "vitest";
import { redactLogFields } from "./structuredLogger";

describe("structuredLogger", () => {
  it("removes sensitive keys and embedded identifiers", () => {
    expect(redactLogFields({
    correlation_id: "req-1",
    recipient_email: "worker@example.com",
    detail: "failed for worker@example.com at https://example.test/a?token=secret",
    count: 2,
    })).toEqual({
    correlation_id: "req-1",
    recipient_email: "[REDACTED]",
    detail: "failed for [REDACTED_EMAIL] at https://example.test/a?token=[REDACTED]",
    count: 2,
    });
  });

  it("bounds untrusted strings", () => {
    expect(String(redactLogFields({ detail: "x".repeat(800) }).detail)).toHaveLength(500);
  });

  it("redacts common credential aliases in URL query strings", () => {
    expect(redactLogFields({
      detail: "https://example.test/callback?access_token=a&api_key=b&password=c&refresh_token=d&client_secret=e&auth=f&session=g",
    }).detail).toBe(
      "https://example.test/callback?access_token=[REDACTED]&api_key=[REDACTED]&password=[REDACTED]&refresh_token=[REDACTED]&client_secret=[REDACTED]&auth=[REDACTED]&session=[REDACTED]",
    );
  });
});
