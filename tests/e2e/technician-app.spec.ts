import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test.describe("technician app smoke", () => {
  test("loads /tech-app and switches to the availability tab", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        userId: "tech-1",
        email: "tech@example.com",
        role: "technician",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            id: "tech-1",
            first_name: "Pat",
            last_name: "Jones",
            role: "technician",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        job_assignments: [
          {
            job_id: "job-1",
            sound_role: "chief",
            lights_role: null,
            video_role: null,
            status: "confirmed",
            assigned_at: "2026-03-10T08:00:00.000Z",
          },
        ],
        timesheets: [
          {
            job_id: "job-1",
            technician_id: "tech-1",
            date: "2026-03-10",
            jobs: {
              id: "job-1",
              title: "Smoke Job",
              start_time: "2026-03-10T08:00:00.000Z",
              end_time: "2026-03-10T18:00:00.000Z",
              location: { name: "Madrid Arena" },
              job_documents: [],
            },
          },
        ],
        technician_availability: [],
        festival_artists: [],
        tours: [],
      },
    });

    await page.goto("/tech-app");

    await expect(page.getByRole("button", { name: "Panel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disponib." })).toBeVisible();

    await page.getByRole("button", { name: "Disponib." }).click();

    await expect(page.getByText("Disponibilidad")).toBeVisible();
  });

  test("redirects technicians away from /dashboard to /tech-app", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "technician",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            role: "technician",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
      },
    });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/tech-app(?:\?|$)/);
  });
});
