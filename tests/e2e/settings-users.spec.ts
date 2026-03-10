import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test.describe("settings and users smoke", () => {
  test("loads settings, expands users, and opens the add-user dialog", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "admin",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            id: "admin-1",
            first_name: "Admin",
            last_name: "Owner",
            email: "admin@example.com",
            role: "admin",
            department: "sound",
            soundvision_access_enabled: true,
            assignable_as_tech: false,
          },
          {
            id: "user-2",
            first_name: "Alex",
            last_name: "Manager",
            email: "alex@example.com",
            role: "management",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
      },
    });

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /expand section/i }).nth(6).click();
    await expect(page.getByText("Alex Manager")).toBeVisible();
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByRole("heading", { name: /crear nuevo usuario/i })).toBeVisible();
  });

  test("redirects technicians away from /settings", async ({ page }) => {
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

    await page.goto("/settings");

    await expect(page).toHaveURL(/\/tech-app(?:\?|$)/);
  });
});
