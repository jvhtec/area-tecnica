import { expect, test } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

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
      "get_active_timesheet_counts_by_technician": [],
      "get_assignment_matrix_staffing": [],
      "get_assignment_matrix_staffing_filtered": [],
      "get_staffing_requests_matrix_filtered": [],
    },
  });

  await page.goto("/job-assignment-matrix");

  await expect(page.getByRole("heading", { name: /matriz de asignación de trabajos/i })).toBeVisible();

  // The department tabs are always on screen on desktop; on a phone they live
  // inside the collapsed "Filtros" panel, so open it to reach them.
  if (isMobileViewport(page)) {
    await page.getByRole("button", { name: /^Filtros/ }).click();
  }
  await expect(page.getByRole("tab", { name: "Sonido" })).toHaveAttribute("data-state", "active");

  const directAssignSwitch = page
    .getByRole("switch", { name: /alternar asignación directa/i })
    .first();
  await expect(directAssignSwitch).toHaveAttribute("aria-checked", "false");

  await directAssignSwitch.click();

  await expect(directAssignSwitch).toHaveAttribute("aria-checked", "true");
});

test("gives touch users the cell action sheet and long-press multi-select", async ({ page }) => {
  test.skip(!isMobileViewport(page), "The action sheet replaces the desktop cell's icon cluster on touch only.");

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
      "get_active_timesheet_counts_by_technician": [],
      "get_assignment_matrix_staffing": [],
      "get_assignment_matrix_staffing_filtered": [],
      "get_staffing_requests_matrix_filtered": [],
    },
  });

  await page.goto("/job-assignment-matrix");
  await expect(page.getByRole("heading", { name: /matriz de asignación de trabajos/i })).toBeVisible();

  const cell = page.locator('[data-matrix-cell="true"]').first();
  await expect(cell).toBeVisible();

  // A tap opens the sheet, where the staffing actions get real labels instead of
  // the 28px icons a phone cell has no room for.
  await cell.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: /pedir disponibilidad por whatsapp/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar oferta por email/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // A long press starts a selection, which is the only multi-select gesture
  // available on touch — ctrl-click cannot be produced there.
  await cell.dispatchEvent("touchstart");
  await page.waitForTimeout(600);
  await cell.dispatchEvent("touchend");

  await expect(page.getByRole("button", { name: /^Acciones$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Limpiar$/ })).toBeVisible();
});
