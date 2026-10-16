import { describe, expect, it } from "vitest";

import {
  buildMissingCampaignRoleInserts,
  buildRequiredRoleQuantityMap,
  campaignClosureReason,
  campaignRoleChanged,
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

describe("campaign closure for jobs that are over", () => {
  const now = new Date("2026-10-16T15:00:00Z");

  it("keeps campaigns running while the job is upcoming or in progress", () => {
    expect(campaignClosureReason({ end_time: "2026-10-20T21:00:00Z", status: "Confirmado" }, now)).toBeNull();
    expect(campaignClosureReason({ end_time: "2026-10-16T21:00:00Z", status: "Tentativa" }, now)).toBeNull();
    expect(campaignClosureReason({ end_time: null, status: null }, now)).toBeNull();
  });

  it("closes campaigns whose job has ended, been cancelled, been completed or been deleted", () => {
    expect(campaignClosureReason({ end_time: "2026-09-12T21:00:00Z", status: "Confirmado" }, now)).toBe("job_ended");
    expect(campaignClosureReason({ end_time: "2026-09-12T21:00:00Z", status: "Completado" }, now)).toBe("job_completed");
    expect(campaignClosureReason({ end_time: "2026-11-01T21:00:00Z", status: "Completado" }, now)).toBe("job_completed");
    expect(campaignClosureReason({ end_time: "2026-11-01T21:00:00Z", status: "Cancelado" }, now)).toBe("job_cancelled");
    expect(campaignClosureReason({ end_time: "2026-11-01T21:00:00Z", status: "cancelado" }, now)).toBe("job_cancelled");
    expect(campaignClosureReason(null, now)).toBe("job_missing");
  });
});

describe("campaign role no-op detection", () => {
  const stored = {
    assigned_count: 2,
    pending_availability: 1,
    confirmed_availability: 0,
    pending_offers: 0,
    accepted_offers: 1,
    stage: "offer",
    wave_number: 3,
    last_wave_at: "2026-10-16T14:00:00+00:00",
  };

  it("treats identical counters as unchanged, whatever the timestamp format", () => {
    expect(campaignRoleChanged(stored, { ...stored, last_wave_at: "2026-10-16T14:00:00.000Z" })).toBe(false);
    expect(campaignRoleChanged({ ...stored, last_wave_at: null }, { ...stored, last_wave_at: null })).toBe(false);
  });

  it("detects any counter, stage, wave or wave-time change", () => {
    expect(campaignRoleChanged(stored, { ...stored, assigned_count: 3 })).toBe(true);
    expect(campaignRoleChanged(stored, { ...stored, stage: "filled" })).toBe(true);
    expect(campaignRoleChanged(stored, { ...stored, wave_number: 4 })).toBe(true);
    expect(campaignRoleChanged(stored, { ...stored, last_wave_at: "2026-10-16T15:00:00Z" })).toBe(true);
    expect(campaignRoleChanged({ ...stored, last_wave_at: null }, stored)).toBe(true);
  });
});
