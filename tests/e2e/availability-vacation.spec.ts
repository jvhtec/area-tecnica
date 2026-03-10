import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test.describe("availability and vacation smoke", () => {
  test("creates a technician availability block with mocked Supabase state", async ({ page }) => {
    const blocks = [] as Array<{ id: string; technician_id: string; date: string; status: string }>;

    await bootstrapApp(page, {
      auth: {
        userId: "house-1",
        email: "house@example.com",
        role: "house_tech",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            id: "house-1",
            first_name: "House",
            last_name: "Tech",
            role: "house_tech",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        technician_availability: ({ method, body }) => {
          if (method === "GET") {
            return blocks;
          }

          if (method === "POST") {
            const rows = Array.isArray(body) ? body : [];
            rows.forEach((row, index) => {
              blocks.push({
                id: `availability-${blocks.length + index + 1}`,
                technician_id: String((row as Record<string, unknown>).technician_id ?? "house-1"),
                date: String((row as Record<string, unknown>).date ?? "2026-03-15"),
                status: String((row as Record<string, unknown>).status ?? "day_off"),
              });
            });
            return rows;
          }

          return null;
        },
      },
    });

    await page.goto("/dashboard/unavailability");

    await expect(page.getByRole("heading", { name: /mis bloqueos de disponibilidad/i })).toBeVisible();
    await page.getByRole("button", { name: /añadir bloqueo/i }).click();
    await page.getByLabel(/inicio/i).fill("2026-03-15");
    await page.getByLabel(/fin/i).fill("2026-03-15");
    await page.getByRole("button", { name: /^crear$/i }).click();

    await expect(page.getByText(/15.*marzo.*2026/i).first()).toBeVisible();
  });

  test("redirects management outside sound/lights away from /disponibilidad", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "video",
      },
      tables: {
        profiles: [
          {
            role: "management",
            department: "video",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
      },
    });

    await page.goto("/disponibilidad");

    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
