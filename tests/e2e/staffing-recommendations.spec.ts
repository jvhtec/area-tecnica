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
          pending_availability: 1,
          confirmed_availability: 1,
          pending_offers: 0,
          accepted_offers: 0,
          stage: "availability",
          wave_number: 1,
        },
      ],
      "profiles": [
        { id: "roleless-pending", profile_picture_url: null },
        { id: "expired-same-role", profile_picture_url: null },
        {
          id: "confirmed-tech",
          first_name: "Confirmed",
          last_name: "Tech",
          nickname: null,
          email: "confirmed@example.com",
          profile_picture_url: null,
        },
        {
          id: "other-role-tech",
          first_name: "Other",
          last_name: "Role",
          nickname: null,
          email: "other@example.com",
          profile_picture_url: null,
        },
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
        {
          id: "availability-confirmed-1",
          job_id: "staffing-job-1",
          profile_id: "confirmed-tech",
          role_code: null,
          phase: "availability",
          status: "confirmed",
          target_date: null,
          single_day: false,
          created_at: "2026-05-12T10:00:00.000Z",
          updated_at: "2026-05-12T10:10:00.000Z",
        },
        {
          id: "availability-confirmed-other-role",
          job_id: "staffing-job-1",
          profile_id: "other-role-tech",
          role_code: null,
          phase: "availability",
          status: "confirmed",
          target_date: null,
          single_day: false,
          created_at: "2026-05-12T10:00:00.000Z",
          updated_at: "2026-05-12T10:12:00.000Z",
        },
      ],
      "staffing_events": [
        {
          staffing_request_id: "availability-confirmed-1",
          event: "email_sent",
          created_at: "2026-05-12T09:55:00.000Z",
          meta: {
            phase: "availability",
            role: "SND-FOH-R",
          },
        },
        {
          staffing_request_id: "availability-confirmed-1",
          event: "whatsapp_sent",
          created_at: "2026-05-12T10:00:00.000Z",
          meta: {
            phase: "availability",
            role: "SND-PA-T",
          },
        },
        {
          staffing_request_id: "availability-confirmed-other-role",
          event: "whatsapp_sent",
          created_at: "2026-05-12T10:00:00.000Z",
          meta: {
            phase: "availability",
            role: "SND-FOH-R",
          },
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
  await page.getByRole("button", { name: "C.A.R.L.O.S." }).click();
  await expect(page.getByText("Required 2")).toBeVisible();
  await expect(page.getByText("0/2 assigned")).toBeVisible();

  await page.getByRole("tab", { name: "Candidates" }).click();

  await expect(page.getByText("SND-PA-T - Recomendaciones de candidatos")).toBeVisible();
  await expect(page.getByText("1 disponibles")).toBeVisible();
  await expect(page.getByText("1 pendientes")).toBeVisible();
  await expect(page.getByText("Roleless Pending")).toBeVisible();
  await expect(page.getByText("Expired Same Role")).toBeVisible();
  await expect(page.getByText("Solicitud sin rol")).toBeVisible();
  await expect(page.getByText(/Solicitud previa de disponibilidad sin rol: pendiente/)).toBeVisible();
  await page.getByRole("button", { name: /ver motivos/i }).first().click();
  await expect(page.getByText("Role experience: 4 completed SND-PA jobs")).toBeVisible();
  await expect(page.getByText("Same Role Pending")).toHaveCount(0);
  await expect(page.getByText("Roleless Declined")).toHaveCount(0);

  const rankCall = calls.rpcCalls.find((call) => call.name === "rank_staffing_candidates");
  expect(rankCall?.body).toMatchObject({
    p_job_id: "staffing-job-1",
    p_department: "sound",
    p_role_code: "SND-PA-T",
  });

  await page.getByRole("combobox", { name: "Seleccionar canal de disponibilidad" }).click();
  await page.getByRole("option", { name: "WhatsApp" }).click();
  await page.getByRole("checkbox", { name: /seleccionar todos/i }).click();
  await page.getByRole("button", { name: /enviar disponibilidad/i }).click();

  await expect(page.getByText("No hay candidatos disponibles para SND-PA-T")).toBeVisible();

  await page.getByRole("tab", { name: "Offers" }).click();
  const confirmedResponses = page.getByTestId("staffing-confirmed-responses");
  await expect(page.getByText("Availability: 1 yes")).toBeVisible();
  await expect(confirmedResponses.getByText("Confirmed Tech")).toBeVisible();
  await expect(confirmedResponses.getByText("Other Role")).toHaveCount(0);
  await expect(confirmedResponses.getByText("Availability yes")).toBeVisible();
  await expect(confirmedResponses.getByText("Job availability")).toBeVisible();
  await page.getByRole("checkbox", { name: /select confirmed tech for offer/i }).click();
  await page.getByRole("button", { name: /send offers \(1\) by email/i }).click();

  await expect.poll(() => calls.functionCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "send-staffing-email",
        body: expect.objectContaining({
          job_id: "staffing-job-1",
          profile_id: "roleless-pending",
          phase: "availability",
          role: "SND-PA-T",
          channel: "whatsapp",
          require_no_conflicts: true,
        }),
      }),
      expect.objectContaining({
        name: "send-staffing-email",
        body: expect.objectContaining({
          job_id: "staffing-job-1",
          profile_id: "confirmed-tech",
          phase: "offer",
          role: "SND-PA-T",
          channel: "email",
        }),
      }),
    ]),
  );
});
