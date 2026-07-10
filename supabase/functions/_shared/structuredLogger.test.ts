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
});
