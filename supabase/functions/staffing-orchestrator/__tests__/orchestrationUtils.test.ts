import { describe, expect, it } from "vitest";

import {
  buildMissingCampaignRoleInserts,
  buildRequiredRoleQuantityMap,
  canResumeCampaignStatus,
  normalizeRoleCode,
} from "../orchestrationUtils.ts";

describe("staffing orchestrator lifecycle utilities", () => {
  it("allows completed campaigns to be resumed for restart workflows", () => {
    expect(canResumeCampaignStatus("paused")).toBe(true);
    expect(canResumeCampaignStatus("stopped")).toBe(true);
    expect(canResumeCampaignStatus("completed")).toBe(true);
    expect(canResumeCampaignStatus("COMPLETED")).toBe(true);

    expect(canResumeCampaignStatus("active")).toBe(false);
    expect(canResumeCampaignStatus("failed")).toBe(false);
    expect(canResumeCampaignStatus(null)).toBe(false);
  });

  it("normalizes required role quantities while ignoring blank role codes", () => {
    expect(normalizeRoleCode(" SND-PA ")).toBe("SND-PA");

    const requiredByRole = buildRequiredRoleQuantityMap([
      { role_code: " SND-PA ", quantity: 2 },
      { role_code: "SND-PA", quantity: 1 },
      { role_code: "LGT-AUX", quantity: -2 },
      { role_code: "", quantity: 5 },
    ]);

    expect(requiredByRole.get("SND-PA")).toBe(3);
    expect(requiredByRole.get("LGT-AUX")).toBe(0);
    expect(requiredByRole.has("")).toBe(false);
  });

  it("creates campaign role rows only for newly required positive-quantity roles", () => {
    const inserts = buildMissingCampaignRoleInserts(
      "campaign-1",
      [
        { role_code: "SND-PA", quantity: 2 },
        { role_code: "LGT-AUX", quantity: 1 },
        { role_code: "VID-CAM", quantity: 0 },
        { role_code: " ", quantity: 3 },
      ],
      [
        { role_code: " SND-PA " },
        { role_code: "OLD-ROLE" },
      ],
    );

    expect(inserts).toEqual([
      {
        campaign_id: "campaign-1",
        role_code: "LGT-AUX",
        stage: "idle",
        wave_number: 0,
        assigned_count: 0,
        pending_availability: 0,
        confirmed_availability: 0,
        pending_offers: 0,
        accepted_offers: 0,
      },
    ]);
  });
});
