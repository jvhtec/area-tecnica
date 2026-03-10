import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test.describe("auth routing smoke", () => {
  test("redirects guests from protected routes to /auth", async ({ page }) => {
    await bootstrapApp(page, {
      auth: { guest: true },
    });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/auth$/);
  });

  test("redirects technicians from dashboard routes to /tech-app", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "technician",
        department: "sound",
      },
      tables: {
        "profiles": [{ role: "technician", selected_job_statuses: ["Confirmado", "Tentativa"] }],
      },
    });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/tech-app(?:\?|$)/);
  });
});
