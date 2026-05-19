import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

const baseCandidate = {
  department: "sound",
  skills_score: 80,
  distance_to_madrid_km: 4,
  proximity_score: 10,
  experience_score: 8,
  reliability_score: 7,
  fairness_score: 6,
  soft_conflict: false,
  hard_conflict: false,
  final_score: 76,
  reasons: [
    "Primary skill: PA technician (lvl 5)",
    "Role experience: 4 completed SND-PA jobs",
  ],
};

test("auto-staffing shows role-less consultations and refreshes candidates after same-role sends", async ({
  page,
}) => {
  let sentAvailability = false;

  const calls = await bootstrapApp(page, {
    auth: {
      role: "management",
      department: "sound",
    },
    tables: {
      "jobs": [
        {
          id: "staffing-job-1",
          title: "Staffing Smoke Job",
          start_time: "2026-06-10T08:00:00.000Z",
          end_time: "2026-06-11T20:00:00.000Z",
          color: "#1d4ed8",
          status: "Confirmado",
          job_type: "single",
          job_departments: [{ department: "sound" }],
          job_assignments: [],
        },
      ],
      "technician_fridge": [],
      "availability_schedules": [],
      "technician_availability": [],
      "vacation_requests": [],
      "timesheets": [],
      "job_assignments": [],
      "job_required_roles_summary": [
        {
          job_id: "staffing-job-1",
          department: "sound",
          roles: [{ role_code: "SND-PA-T", quantity: 2 }],
        },
      ],
      "staffing_campaigns": [
        {
          id: "campaign-1",
          job_id: "staffing-job-1",
          department: "sound",
          mode: "assisted",
          status: "active",
          policy: {
            weights: {
              skills: 0.5,
              proximity: 0.1,
              reliability: 0.2,
              fairness: 0.1,
              experience: 0.1,
            },
            soft_conflict_policy: "warn",
            exclude_fridge: true,
          },
          offer_message: null,
          created_at: "2026-05-12T10:00:00.000Z",
          updated_at: "2026-05-12T10:00:00.000Z",
        },
      ],
      "staffing_campaign_roles": [
        {
          id: "campaign-role-1",
          campaign_id: "campaign-1",
          role_code: "SND-PA-T",
          assigned_count: 0,
          pending_availability: 0,
          confirmed_availability: 0,
          pending_offers: 0,
          accepted_offers: 0,
          stage: "availability",
          wave_number: 1,
        },
      ],
      "profiles": [
        { id: "roleless-pending", profile_picture_url: null },
        { id: "expired-same-role", profile_picture_url: null },
      ],
      "staffing_requests": [
        {
          profile_id: "roleless-pending",
          phase: "availability",
          status: "pending",
          target_date: null,
          single_day: false,
          updated_at: "2026-05-12T10:05:00.000Z",
        },
      ],
    },
    rpc: {
      "get_profiles_with_skills": [],
      "get_job_staffing_summary": [],
      "get_active_timesheet_counts_by_technician": [],
      "get_assignment_matrix_staffing": [],
      "get_assignment_matrix_staffing_filtered": [],
      "get_staffing_requests_matrix_filtered": [],
      "rank_staffing_candidates": () => sentAvailability
        ? []
        : [
          {
            ...baseCandidate,
            profile_id: "roleless-pending",
            full_name: "Roleless Pending",
          },
          {
            ...baseCandidate,
            profile_id: "expired-same-role",
            full_name: "Expired Same Role",
            final_score: 70,
          },
        ],
    },
    functions: {
      "send-staffing-email": ({ body }) => {
        sentAvailability = true;
        return {
          success: true,
          received: body,
        };
      },
    },
  });

  await page.goto("/job-assignment-matrix");

  await page.getByRole("button", { name: /ver recordatorio de staffing/i }).click();
  await page.getByRole("button", { name: "Auto staffing" }).click();
  await page.getByRole("tab", { name: "Candidates" }).click();

  await expect(page.getByText("SND-PA-T - Candidate Recommendations")).toBeVisible();
  await expect(page.getByText("Roleless Pending")).toBeVisible();
  await expect(page.getByText("Expired Same Role")).toBeVisible();
  await expect(page.getByText("No-role request")).toBeVisible();
  await expect(page.getByText(/Prior manager availability request without role is pending/)).toBeVisible();
  await page.getByRole("button", { name: /show reasons/i }).first().click();
  await expect(page.getByText("Role experience: 4 completed SND-PA jobs")).toBeVisible();
  await expect(page.getByText("Same Role Pending")).toHaveCount(0);
  await expect(page.getByText("Roleless Declined")).toHaveCount(0);

  const rankCall = calls.rpcCalls.find((call) => call.name === "rank_staffing_candidates");
  expect(rankCall?.body).toMatchObject({
    p_job_id: "staffing-job-1",
    p_department: "sound",
    p_role_code: "SND-PA-T",
  });

  await page.getByRole("checkbox", { name: /select all/i }).click();
  await page.getByRole("button", { name: /send availability/i }).click();

  await expect(page.getByText("No candidates available for SND-PA-T")).toBeVisible();

  expect(calls.functionCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "send-staffing-email",
        body: expect.objectContaining({
          job_id: "staffing-job-1",
          profile_id: "roleless-pending",
          phase: "availability",
          role: "SND-PA-T",
          require_no_conflicts: true,
        }),
      }),
    ]),
  );
});
