import { afterEach, describe, expect, it, vi } from "vitest";

import type { CampaignPolicy } from "../policyUtils.ts";
import {
  assignmentRoleColumnForDepartment,
  canManageCampaign,
  inferJobProfile,
  inferRoleProfile,
  isCriticalRole,
  normalizeCampaignPolicy,
  normalizeProfileName,
} from "../policyUtils.ts";

describe("staffing orchestrator policy utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("infers high-risk timing and critical role profiles for large festival campaigns", () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-09T10:00:00.000Z");
    vi.setSystemTime(now);

    const policyOverrides: Partial<CampaignPolicy> = {
      weights: { reliability: 0.5 } as CampaignPolicy["weights"],
    };

    const policy = normalizeCampaignPolicy(
      policyOverrides,
      {
        job_type: "festival",
        start_time: "2026-06-20T18:00:00.000Z",
      },
      [
        { role_code: "SND-PA-LEAD", quantity: 2 },
        { role_code: "STAGEHAND ASSIST", quantity: 3 },
      ],
      "auto",
    );

    expect(policy.profile).toMatchObject({
      inferred_job_profile: "high_risk_critical",
      selected_job_profile: "high_risk_critical",
      manual_profile_override: false,
    });
    expect(policy.weights).toMatchObject({
      skills: 0.4,
      role_skill: 0.4,
      reliability: 0.5,
      house_tech_bonus: 0.1,
    });
    expect(policy.offer_ttl_hours).toBe(2);
    expect(policy.soft_conflict_policy).toBe("block");
    expect(policy.escalation).toMatchObject({ minimum_auto_book_score: 75 });
    expect(policy.surrounding_jobs).toEqual({
      enabled: true,
      max_location_distance_km: 25,
    });
    expect(policy.role_profiles?.["SND-PA-LEAD"]).toMatchObject({
      inferred_profile: "high_risk_critical",
      selected_profile: "high_risk_critical",
      is_critical: true,
      required_count: 2,
    });
  });

  it("honors manual profile overrides and keeps assisted campaigns in warn mode", () => {
    const policy = normalizeCampaignPolicy(
      {
        profile: {
          selected_job_profile: "training_friendly",
          override_reason: "junior shadowing",
        },
        role_profiles: {
          "LGT-AUX": {
            inferred_profile: "training_friendly",
            selected_profile: "standard",
            assigned_count: 1,
          },
        },
        cost_scoring: {
          penalty_strength: "high",
          max_rate_penalty: 20,
        },
        surrounding_jobs: {
          max_location_distance_km: 15,
        },
        channel: "whatsapp",
      },
      {
        job_type: "single",
        start_time: "2026-06-20T18:00:00.000Z",
      },
      [{ role_code: "LGT-AUX", quantity: 2 }],
      "assisted",
    );

    expect(policy.profile).toMatchObject({
      selected_job_profile: "training_friendly",
      manual_profile_override: true,
      override_reason: "junior shadowing",
    });
    expect(policy.role_profiles?.["LGT-AUX"]).toMatchObject({
      inferred_profile: "training_friendly",
      selected_profile: "standard",
      manual_override: true,
      assigned_count: 1,
    });
    expect(policy.soft_conflict_policy).toBe("warn");
    expect(policy.channel).toBe("whatsapp");
    expect(policy.cost_scoring).toEqual({
      enabled: true,
      penalty_strength: "high",
      max_rate_penalty: 20,
    });
    expect(policy.surrounding_jobs).toEqual({
      enabled: true,
      max_location_distance_km: 15,
    });
  });

  it("infers overnight jobs as multi-day tours and preserves explicit wave controls", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:00.000Z"));

    expect(inferJobProfile({
      job_type: "single",
      start_time: "2026-06-20T22:00:00.000Z",
      end_time: "2026-06-21T02:00:00.000Z",
    }, 2)).toBe("multi_day_tour");

    const policy = normalizeCampaignPolicy(
      {
        waves: {
          size_mode: "fixed",
          fixed_size: 8,
          max_waves: 0,
          wait_minutes: 0,
        },
      },
      {
        job_type: "single",
        start_time: "2026-06-20T22:00:00.000Z",
        end_time: "2026-06-21T02:00:00.000Z",
      },
      [{ role_code: "LGT-AUX", quantity: 2 }],
      "assisted",
    );

    expect(policy.profile).toMatchObject({
      inferred_job_profile: "multi_day_tour",
      selected_job_profile: "multi_day_tour",
    });
    expect(policy.waves).toMatchObject({
      size_mode: "fixed",
      fixed_size: 8,
      max_waves: 0,
      wait_minutes: 0,
    });
  });

  it("normalizes profile, role, department, and management authorization decisions", async () => {
    expect(normalizeProfileName("not-a-profile")).toBe("standard");
    expect(inferJobProfile({ job_type: "tourdate" }, 2)).toBe("multi_day_tour");
    expect(inferJobProfile({ job_type: "single" }, 10)).toBe("high_risk_critical");
    expect(inferRoleProfile("standard", "MONITOR ASSIST")).toBe("training_friendly");
    expect(inferRoleProfile("standard", "SND-FOH")).toBe("standard");
    expect(isCriticalRole("RF TECH")).toBe(true);

    expect(assignmentRoleColumnForDepartment("sound")).toBe("sound_role");
    expect(assignmentRoleColumnForDepartment("lights")).toBe("lights_role");
    expect(assignmentRoleColumnForDepartment("video")).toBe("video_role");
    expect(assignmentRoleColumnForDepartment("production")).toBe("production_role");
    expect(assignmentRoleColumnForDepartment("unknown")).toBeNull();

    await expect(canManageCampaign({ role: "admin" }, "sound")).resolves.toBe(true);
    await expect(canManageCampaign({ role: "management", department: "lights" }, "sound")).resolves.toBe(false);
    await expect(canManageCampaign({ role: "management", department: "sound" }, "sound")).resolves.toBe(true);
    await expect(canManageCampaign({ role: "technician", department: "sound" }, "sound")).resolves.toBe(false);
  });
});
