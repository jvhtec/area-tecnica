import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

const festivalJob = {
  id: "festival-job-1",
  title: "Festival Smoke",
  description: "Outdoor run",
  start_time: "2026-07-10T12:00:00.000Z",
  end_time: "2026-07-12T23:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  job_type: "festival",
  location_id: "loc-1",
};

test.describe("festival management smoke", () => {
  test("loads the overview and opens the WhatsApp dialog", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "sound",
      },
      functions: {
        "get-google-maps-key": { apiKey: "test-google-key" },
      },
      tables: {
        profiles: [
          {
            id: "e2e-user",
            role: "management",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        jobs: [festivalJob],
        locations: [
          {
            id: "loc-1",
            name: "Madrid Arena",
            formatted_address: "Madrid Arena",
            latitude: 40.4168,
            longitude: -3.7038,
          },
        ],
        festival_artists: [
          { id: "artist-1", job_id: "festival-job-1", name: "Alpha" },
          { id: "artist-2", job_id: "festival-job-1", name: "Beta" },
        ],
        festival_artist_files: [],
        festival_gear_setups: [{ job_id: "festival-job-1", max_stages: 2 }],
        festival_stages: [
          { job_id: "festival-job-1", number: 1, name: "Main" },
          { job_id: "festival-job-1", number: 2, name: "Club" },
        ],
        flex_folders: [{ job_id: "festival-job-1", department: "sound", folder_type: "department", element_id: "flex-1" }],
        job_documents: [],
        job_whatsapp_group_requests: [],
        job_whatsapp_groups: [],
        tour_dates: [],
        tours: [],
      },
    });

    await page.goto("/festival-management/festival-job-1");

    await expect(page.getByRole("heading", { name: "Festival Smoke" })).toBeVisible();
    await expect(page.getByText("Acciones Rápidas")).toBeVisible();
    await page.getByRole("button", { name: "Crear Grupo" }).click();
    await expect(page.getByRole("heading", { name: "Crear Grupo de WhatsApp" })).toBeVisible();
  });

  test("loads the public blank artist requirements form", async ({ page }) => {
    await bootstrapApp(page, {
      auth: { guest: true },
      tables: {
        festival_gear_setups: [{ job_id: "festival-job-1", max_stages: 2 }],
        festival_logos: [],
        festival_stages: [
          { job_id: "festival-job-1", number: 1, name: "Main" },
          { job_id: "festival-job-1", number: 2, name: "Club" },
        ],
      },
    });

    await page.goto("/festival/artist-form/blank?jobId=festival-job-1&date=2026-07-10&lang=en");

    await expect(page.getByRole("heading", { name: "Artist Technical Requirements Form (Blank)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print Blank Form" })).toBeVisible();
    await expect(page.getByText("Basic Info")).toBeVisible();
  });
});
