import { describe, expect, it } from "vitest";

import { pushTargetFingerprint } from "./targetId";

describe("pushTargetFingerprint", () => {
  it("returns a stable opaque identifier without exposing the target", async () => {
    const endpoint = "https://push.example/subscription/secret-token";
    const first = await pushTargetFingerprint("webpush", endpoint);
    const second = await pushTargetFingerprint("webpush", endpoint);

    expect(first).toBe(second);
    expect(first).toMatch(/^webpush:[a-f0-9]{16}$/);
    expect(first).not.toContain("secret-token");
  });
});

