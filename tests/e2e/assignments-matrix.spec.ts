import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test("renders the assignments matrix and lets management toggle direct assign mode", async ({
  page,
}) => {
  await bootstrapApp(page, {
    auth: {
      role: "management",
      department: "sound",
    },
    tables: {
      "jobs": [
        {
          id: "matrix-job-1",
          title: "Matrix Smoke Job",
          start_time: "2026-03-10T08:00:00.000Z",
          end_time: "2026-03-10T20:00:00.000Z",
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
      "profiles": [],
      "skills": [],
      "job_required_roles_summary": [],
    },
    rpc: {
      "get_profiles_with_skills": [
        {
          id: "tech-1",
          first_name: "Pat",
          last_name: "Jones",
          email: "pat@example.com",
          department: "sound",
          role: "technician",
          skills: [],
        },
      ],
      "get_job_staffing_summary": [],
      "get_assignment_matrix_staffing": [],
    },
  });

  await page.goto("/job-assignment-matrix");

  await expect(page.getByRole("heading", { name: /matriz de asignación de trabajos/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sonido" })).toHaveAttribute("data-state", "active");

  const directAssignSwitch = page
    .getByRole("switch", { name: /alternar asignación directa/i })
    .first();
  await expect(directAssignSwitch).toHaveAttribute("aria-checked", "false");

  await directAssignSwitch.click();

  await expect(directAssignSwitch).toHaveAttribute("aria-checked", "true");
});
