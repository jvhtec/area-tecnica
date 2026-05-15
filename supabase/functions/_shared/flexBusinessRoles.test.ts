import { describe, expect, it } from "vitest";

import {
  businessRoleIdFor,
  businessRoleLookupFor,
  inferTierFromRoleCode,
} from "./flexBusinessRoles.ts";

describe("flexBusinessRoles", () => {
  it("maps known sound tiers to Flex dictionary IDs", () => {
    expect(inferTierFromRoleCode("FOH-R")).toBe("responsable");
    expect(businessRoleIdFor("sound", "responsable")).toBe("2916b300-c515-11ea-a087-2a0a4490a7fb");
  });

  it("returns diagnostics for unsupported lights and video mappings", () => {
    const lights = businessRoleLookupFor("lights", "tecnico");
    const video = businessRoleLookupFor("video", "especialista");

    expect(lights.supported).toBe(false);
    expect(lights.diagnostic).toContain("lights Flex business-role ID");
    expect(video.supported).toBe(false);
    expect(video.diagnostic).toContain("video Flex business-role ID");
  });

  it("returns diagnostics when a tier cannot be inferred", () => {
    const lookup = businessRoleLookupFor("sound", inferTierFromRoleCode("FOH"));

    expect(lookup.supported).toBe(false);
    expect(lookup.diagnostic).toContain("-R, -E, or -T");
  });
});
