import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp } from "./support/app";

const makeJob = () => {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(18, 0, 0, 0);

  return {
    id: "mobile-smoke-job",
    title: "Trabajo móvil de prueba",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: "Confirmado",
    job_type: "single",
    color: "#2563eb",
    location: {
      id: "mobile-smoke-location",
      name: "Madrid Arena",
      formatted_address: "Madrid Arena",
      latitude: null,
      longitude: null,
    },
    job_departments: [{ department: "sound" }],
    job_assignments: [],
    job_documents: [],
    flex_folders: [],
    tour_id: null,
  };
};

const bootstrapManagement = async (page: Page) => {
  await bootstrapApp(page, {
    auth: {
      userId: "user-1",
      role: "management",
      department: "sound",
    },
    tables: {
      profiles: [
        {
          id: "user-1",
          first_name: "María",
          last_name: "Pruebas",
          role: "management",
          department: "sound",
          selected_job_statuses: ["Confirmado", "Tentativa"],
          selected_job_types: [],
        },
      ],
      jobs: [makeJob()],
      tours: [],
      technician_fridge: [],
      availability_schedules: [],
      technician_availability: [],
      vacation_requests: [],
      timesheets: [],
      job_assignments: [],
      skills: [],
      job_required_roles_summary: [],
    },
    rpc: {
      get_profiles_with_skills: [],
      get_job_staffing_summary: [],
      get_active_timesheet_counts_by_technician: [],
      get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [],
      get_staffing_requests_matrix_filtered: [],
    },
  });
};

const expectMobileShell = async (page: Page) => {
  await expect(page.locator("[data-mobile-navbar]")).toBeVisible();
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
};

test.describe("mobile navigation smoke", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "This suite targets the explicit mobile viewport project.",
    );
  });

  test("keeps the dashboard inside the viewport", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await expectMobileShell(page);
  });

  test("keeps project management inside the viewport", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/project-management");

    await expect(page.getByText("Trabajo móvil de prueba")).toBeVisible();
    await expectMobileShell(page);
  });

  test("keeps the department hub inside the viewport", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/sound");

    await expect(page.getByRole("heading", { name: "Sonido" })).toBeVisible();
    await expectMobileShell(page);
  });
});
