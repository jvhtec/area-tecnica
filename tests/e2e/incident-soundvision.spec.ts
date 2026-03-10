import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test.describe("incident reports and SoundVision smoke", () => {
  test("loads incident reports with the mocked report cards", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        userId: "manager-1",
        role: "management",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            id: "manager-1",
            first_name: "Alex",
            last_name: "Manager",
            email: "alex@example.com",
            role: "management",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
          {
            id: "tech-1",
            first_name: "Pat",
            last_name: "Jones",
            email: "pat@example.com",
            role: "technician",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        job_documents: [
          {
            id: "incident-1",
            job_id: "job-1",
            file_name: "incident-report.pdf",
            file_path: "incident-reports/incident-report.pdf",
            file_type: "application/pdf",
            file_size: 1024,
            uploaded_by: "tech-1",
            uploaded_at: "2026-03-10T12:00:00.000Z",
            job: {
              id: "job-1",
              title: "Smoke Job",
              start_time: "2026-03-10T08:00:00.000Z",
              end_time: "2026-03-10T20:00:00.000Z",
            },
          },
        ],
      },
    });

    await page.goto("/incident-reports");

    await expect(page.getByRole("heading", { name: /incident reports management/i })).toBeVisible();
    await expect(page.getByText("incident-report.pdf")).toBeVisible();
    await expect(page.getByRole("button", { name: /descargar/i })).toBeVisible();
  });

  test("shows the restricted SoundVision access request flow", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "house_tech",
        department: "lights",
        soundVisionAccess: false,
      },
      tables: {
        profiles: [
          {
            role: "house_tech",
            department: "lights",
            soundvision_access: false,
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
      },
    });

    await page.goto("/soundvision-files");

    await expect(page.getByText("Acceso Restringido").first()).toBeVisible();
    await expect(page.getByText("Solicitar Acceso").first()).toBeVisible();
  });
});
