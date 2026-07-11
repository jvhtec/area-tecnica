import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp } from "./support/app";

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("accessibility smoke", () => {
  test("keeps the public authentication journey free of automated axe violations", async ({ page }) => {
    await bootstrapApp(page, { auth: { guest: true } });
    await page.goto("/auth");

    await expect(page.getByRole("heading")).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("keeps the technician mobile journey keyboard-accessible and axe-clean", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootstrapApp(page, {
      auth: {
        userId: "tech-a11y",
        role: "technician",
        department: "sound",
      },
      tables: {
        profiles: [{
          id: "tech-a11y",
          first_name: "Pat",
          last_name: "Jones",
          role: "technician",
          department: "sound",
          soundvision_access_enabled: false,
          assignable_as_tech: false,
        }],
        job_assignments: [],
        timesheets: [],
        technician_availability: [],
        festival_artists: [],
        tours: [],
      },
    });

    await page.goto("/tech-app");
    await expect(page.getByRole("button", { name: "Panel" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator("button:focus, a:focus, input:focus, select:focus, textarea:focus")).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
});
