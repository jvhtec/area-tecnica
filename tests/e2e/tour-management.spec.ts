import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

const smokeTour = {
  id: "tour-1",
  name: "World Tour",
  description: "Arena run",
  color: "#2563eb",
  start_date: "2026-03-05",
  end_date: "2026-03-20",
  tour_dates: [
    {
      id: "tour-date-1",
      date: "2026-03-12T20:00:00.000Z",
      location: { id: "loc-1", name: "Madrid Arena" },
    },
  ],
};

test.describe("tour management smoke", () => {
  test("loads the management overview and opens the WhatsApp dialog", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            role: "management",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        tours: [smokeTour],
        jobs: [
          {
            id: "tour-job-1",
            tour_id: "tour-1",
            job_type: "tour",
          },
        ],
        job_whatsapp_groups: [],
        job_whatsapp_group_requests: [],
      },
    });

    await page.goto("/tour-management/tour-1");

    await expect(page.getByRole("heading", { name: "World Tour" })).toBeVisible();
    await expect(page.getByText("Áreas de Gestión")).toBeVisible();
    await page.getByRole("button", { name: /grupo whatsapp/i }).click();
    await expect(page.getByRole("heading", { name: /crear grupo de whatsapp/i })).toBeVisible();
  });

  test("keeps house-tech users in the read-only tours route", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "house_tech",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            role: "house_tech",
            department: "sound",
            tours_expanded: true,
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        tours: [
          {
            id: "tour-1",
            name: "World Tour",
            end_date: "2026-03-20",
          },
        ],
      },
    });

    await page.goto("/tours");

    await expect(page.getByText(/tours 2026/i)).toBeVisible();
    await page.getByRole("heading", { name: "World Tour" }).click();
    await expect(page).toHaveURL(/\/tours$/);
  });
});
