import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test("loads project management with the department default and mocked jobs", async ({ page }) => {
  const start = new Date();
  const end = new Date(start.getTime() + 9 * 60 * 60 * 1000);

  await bootstrapApp(page, {
    auth: {
      role: "management",
      department: "sound",
    },
    tables: {
      "profiles": [
        {
          role: "management",
          selected_job_statuses: ["Confirmado", "Tentativa"],
        },
      ],
      "jobs": [
        {
          id: "job-smoke-1",
          title: "Smoke PM Job",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "Confirmado",
          job_type: "single",
          location: {
            id: "loc-1",
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
        },
      ],
      "tours": [],
    },
  });

  await page.goto("/project-management");

  await expect(page.getByRole("heading", { name: /gestión de proyectos/i })).toBeVisible();
  await expect(page.getByText("Smoke PM Job")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sonido" })).toHaveAttribute("data-state", "active");
});
