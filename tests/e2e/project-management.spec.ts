import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test("loads project management with the department default and mocked jobs", async ({ page }) => {
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
          start_time: "2026-03-10T09:00:00.000Z",
          end_time: "2026-03-10T18:00:00.000Z",
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

  await expect(page.getByRole("heading", { name: /project management/i })).toBeVisible();
  await expect(page.getByText("Smoke PM Job")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sonido" })).toHaveAttribute("data-state", "active");
});
