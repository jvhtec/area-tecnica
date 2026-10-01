import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignmentRoleColumnForDepartment,
  canManageCampaign,
  inferJobProfile,
  inferRoleProfile,
  isCriticalRole,
  normalizeCampaignPolicy,
  normalizeProfileName,
} from "../policyUtils.ts";

describe("staffing orchestrator Phase 1 policy characterization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("profile normalization and inference", () => {
    it("keeps known profiles and falls back unknown profiles to standard", () => {
      expect(normalizeProfileName("multi_day_tour")).toBe("multi_day_tour");
      expect(normalizeProfileName("high_risk_critical")).toBe("high_risk_critical");
      expect(normalizeProfileName("not-a-profile")).toBe("standard");
      expect(normalizeProfileName(null)).toBe("standard");
    });

    it("treats jobs starting within six hours as emergency fill", () => {
      expect(
        inferJobProfile(
          {
            job_type: "single",
            start_time: "2026-10-01T15:59:59.000Z",
            end_time: "2026-10-01T22:00:00.000Z",
          },
          2,
        ),
      ).toBe("emergency_fill");
    });

    it("also treats already-started jobs as emergency fill", () => {
      expect(
        inferJobProfile(
          {
            job_type: "festival",
            start_time: "2026-10-01T09:00:00.000Z",
            end_time: "2026-10-01T22:00:00.000Z",
          },
          20,
        ),
      ).toBe("emergency_fill");
    });

    it("infers tourdate and ciclo as multi-day tour profiles outside the emergency window", () => {
      expect(
        inferJobProfile(
          {
            job_type: "tourdate",
            start_time: "2026-10-03T08:00:00.000Z",
            end_time: "2026-10-03T22:00:00.000Z",
          },
          2,
        ),
      ).toBe("multi_day_tour");

      expect(
        inferJobProfile(
          {
            job_type: "ciclo",
            start_time: "2026-10-03T08:00:00.000Z",
            end_time: "2026-10-03T22:00:00.000Z",
          },
          2,
        ),
      ).toBe("multi_day_tour");
    });

    it("infers any job spanning UTC dates as multi-day tour", () => {
      expect(
        inferJobProfile(
          {
            job_type: "single",
            start_time: "2026-10-03T20:00:00.000Z",
            end_time: "2026-10-04T02:00:00.000Z",
          },
          2,
        ),
      ).toBe("multi_day_tour");
    });

    it("infers festival or ten-plus crew as high risk when not multi-day/emergency", () => {
      expect(
        inferJobProfile(
          {
            job_type: "festival",
            start_time: "2026-10-03T08:00:00.000Z",
            end_time: "2026-10-03T22:00:00.000Z",
          },
          3,
        ),
      ).toBe("high_risk_critical");

      expect(
        inferJobProfile(
          {
            job_type: "single",
            start_time: "2026-10-03T08:00:00.000Z",
            end_time: "2026-10-03T22:00:00.000Z",
          },
          10,
        ),
      ).toBe("high_risk_critical");
    });

    it("keeps ordinary future single jobs standard", () => {
      expect(
        inferJobProfile(
          {
            job_type: "single",
            start_time: "2026-10-03T08:00:00.000Z",
            end_time: "2026-10-03T22:00:00.000Z",
          },
          4,
        ),
      ).toBe("standard");
    });
  });

  describe("role criticality and role-profile inference", () => {
    it.each([
      "A1",
      "V1",
      "PM",
      "RF",
      "Crew Chief",
      "crew_chief",
      "SYSTEM",
      "Systems Lead",
      "SND-PA",
      "SND-PA-AUX",
      "LGT-MON",
      "LGT-MON-RESP",
    ])("recognizes %s as a critical role", (role) => {
      expect(isCriticalRole(role)).toBe(true);
    });

    it.each(["A10", "VRF2", "PA", "FOH-AUX", "STAGEHAND", "RUNNER"])(
      "does not over-classify %s as critical",
      (role) => {
        expect(isCriticalRole(role)).toBe(false);
      },
    );

    it("keeps all roles on a multi-day tour profile", () => {
      expect(inferRoleProfile("multi_day_tour", "SND-PA")).toBe("multi_day_tour");
      expect(inferRoleProfile("multi_day_tour", "STAGEHAND")).toBe("multi_day_tour");
    });

    it("promotes critical roles to high-risk outside multi-day tours", () => {
      expect(inferRoleProfile("standard", "SND-PA")).toBe("high_risk_critical");
    });

    it("makes helper roles training-friendly outside emergency fill", () => {
      expect(inferRoleProfile("standard", "STAGEHAND")).toBe("training_friendly");
      expect(inferRoleProfile("local_low_complexity", "AUX")).toBe("training_friendly");
    });

    it("does not make helper roles training-friendly during emergency fill", () => {
      expect(inferRoleProfile("emergency_fill", "RUNNER")).toBe("emergency_fill");
    });

    it("leaves ordinary roles on the job profile", () => {
      expect(inferRoleProfile("standard", "FOH")).toBe("standard");
    });
  });

  describe("campaign policy normalization", () => {
    const job = {
      job_type: "single",
      start_time: "2026-10-03T08:00:00.000Z",
      end_time: "2026-10-03T22:00:00.000Z",
    };
    const roles = [
      { role_code: "FOH", quantity: 1 },
      { role_code: "SND-PA", quantity: 2 },
    ];

    it("uses standard assisted defaults for an ordinary job", () => {
      const policy = normalizeCampaignPolicy({}, job, roles, "assisted");

      expect(policy.profile).toMatchObject({
        inferred_job_profile: "standard",
        selected_job_profile: "standard",
        manual_profile_override: false,
      });
      expect(policy.availability_ttl_hours).toBe(24);
      expect(policy.offer_ttl_hours).toBe(4);
      expect(policy.offer_buffer).toBe(2);
      expect(policy.soft_conflict_policy).toBe("warn");
      expect(policy.channel).toBe("email");
      expect(policy.waves).toMatchObject({
        mode: "controlled_waves",
        size_mode: "required_plus_buffer",
        buffer: 2,
        max_waves: 3,
        wait_minutes: 20,
        auto_send_next_wave: false,
      });
    });

    it("changes automatic-mode conflict and wave defaults", () => {
      const policy = normalizeCampaignPolicy({}, job, roles, "auto");
      expect(policy.soft_conflict_policy).toBe("block");
      expect(policy.waves?.auto_send_next_wave).toBe(true);
    });

    it("records a manual job-profile override and uses that profile timing", () => {
      const policy = normalizeCampaignPolicy(
        {
          profile: {
            selected_job_profile: "emergency_fill",
            override_reason: "Last-minute call",
          },
        },
        job,
        roles,
        "assisted",
      );

      expect(policy.profile).toMatchObject({
        inferred_job_profile: "standard",
        selected_job_profile: "emergency_fill",
        manual_profile_override: true,
        override_reason: "Last-minute call",
      });
      expect(policy.availability_ttl_hours).toBe(4);
      expect(policy.offer_ttl_hours).toBe(1);
      expect(policy.waves?.wait_minutes).toBe(5);
      expect(policy.waves?.max_waves).toBe(4);
    });

    it("infers critical and ordinary role profiles independently", () => {
      const policy = normalizeCampaignPolicy({}, job, roles, "assisted");
      expect(policy.role_profiles?.FOH).toMatchObject({
        inferred_profile: "standard",
        selected_profile: "standard",
        is_critical: false,
        required_count: 1,
      });
      expect(policy.role_profiles?.["SND-PA"]).toMatchObject({
        inferred_profile: "high_risk_critical",
        selected_profile: "high_risk_critical",
        is_critical: true,
        required_count: 2,
      });
    });

    it("preserves explicit role-profile selections and assigned counts", () => {
      const policy = normalizeCampaignPolicy(
        {
          role_profiles: {
            FOH: {
              inferred_profile: "standard",
              selected_profile: "training_friendly",
              assigned_count: 3,
            },
          },
        },
        job,
        roles,
        "assisted",
      );

      expect(policy.role_profiles?.FOH).toMatchObject({
        inferred_profile: "standard",
        selected_profile: "training_friendly",
        manual_override: true,
        assigned_count: 3,
      });
    });

    it("preserves explicit weight, channel, conflict and fridge overrides", () => {
      const policy = normalizeCampaignPolicy(
        {
          weights: { skills: 0.99 },
          channel: "whatsapp",
          soft_conflict_policy: "manager_approval",
          exclude_fridge: false,
          assisted_handoff_priority: false,
        },
        job,
        roles,
        "assisted",
      );

      expect(policy.weights.skills).toBe(0.99);
      expect(policy.channel).toBe("whatsapp");
      expect(policy.soft_conflict_policy).toBe("manager_approval");
      expect(policy.exclude_fridge).toBe(false);
      expect(policy.assisted_handoff_priority).toBe(false);
    });

    it("falls back any unsupported channel to email", () => {
      const policy = normalizeCampaignPolicy(
        { channel: "sms" as "email" },
        job,
        roles,
        "assisted",
      );
      expect(policy.channel).toBe("email");
    });

    it("clamps a fixed wave size below one to one", () => {
      const policy = normalizeCampaignPolicy(
        { waves: { fixed_size: 0 } },
        job,
        roles,
        "assisted",
      );
      expect(policy.waves?.fixed_size).toBe(1);
    });

    it("preserves zero for nullish-based wave and location settings", () => {
      const policy = normalizeCampaignPolicy(
        {
          offer_buffer: 0,
          waves: {
            buffer: 0,
            max_waves: 0,
            wait_minutes: 0,
          },
          surrounding_jobs: {
            max_location_distance_km: 0,
          },
        },
        job,
        roles,
        "assisted",
      );

      expect(policy.offer_buffer).toBe(0);
      expect(policy.waves?.buffer).toBe(0);
      expect(policy.waves?.max_waves).toBe(0);
      expect(policy.waves?.wait_minutes).toBe(0);
      expect(policy.surrounding_jobs?.max_location_distance_km).toBe(0);
    });

    it("currently replaces zero TTL and max-rate-penalty values with defaults", () => {
      const policy = normalizeCampaignPolicy(
        {
          availability_ttl_hours: 0,
          offer_ttl_hours: 0,
          cost_scoring: { max_rate_penalty: 0 },
        },
        job,
        roles,
        "assisted",
      );

      expect(policy.availability_ttl_hours).toBe(24);
      expect(policy.offer_ttl_hours).toBe(4);
      expect(policy.cost_scoring?.max_rate_penalty).toBe(10);
    });

    it("defaults the audit and auto-close safety switches on", () => {
      const policy = normalizeCampaignPolicy({}, job, roles, "auto");
      expect(policy.auto_close).toMatchObject({
        close_when_filled: true,
        stop_future_waves: true,
        block_extra_acceptances: true,
        confirm_booked_crew: true,
      });
      expect(policy.audit).toMatchObject({
        log_inferred_profile: true,
        log_score_breakdown: true,
        require_manual_override_reason: true,
      });
    });
  });

  describe("department role mapping", () => {
    it.each([
      ["sound", "sound_role"],
      ["SOUND", "sound_role"],
      ["lights", "lights_role"],
      ["video", "video_role"],
      ["production", "production_role"],
    ])("maps %s to %s", (department, column) => {
      expect(assignmentRoleColumnForDepartment(department)).toBe(column);
    });

    it("returns null for departments without an assignment role column", () => {
      expect(assignmentRoleColumnForDepartment("personnel")).toBeNull();
      expect(assignmentRoleColumnForDepartment("")).toBeNull();
    });
  });

  describe("campaign management authorization", () => {
    it("allows admin and logistics across departments", async () => {
      await expect(canManageCampaign({ role: "admin", department: "video" }, "sound")).resolves.toBe(true);
      await expect(canManageCampaign({ role: "logistics", department: null }, "lights")).resolves.toBe(true);
    });

    it("allows unscoped management across departments", async () => {
      await expect(canManageCampaign({ role: "management", department: null }, "video")).resolves.toBe(true);
    });

    it("allows management in its own department", async () => {
      await expect(canManageCampaign({ role: "management", department: "sound" }, "sound")).resolves.toBe(true);
    });

    it("allows logistics-scoped management to manage production", async () => {
      await expect(
        canManageCampaign({ role: "management", department: "logistics" }, "production"),
      ).resolves.toBe(true);
    });

    it("rejects cross-department management outside the production/logistics exception", async () => {
      await expect(canManageCampaign({ role: "management", department: "sound" }, "lights")).resolves.toBe(false);
    });

    it("rejects technicians and missing users", async () => {
      await expect(canManageCampaign({ role: "technician", department: "sound" }, "sound")).resolves.toBe(false);
      await expect(canManageCampaign(null, "sound")).resolves.toBe(false);
    });
  });
});
