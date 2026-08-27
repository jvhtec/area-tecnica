import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp } from "./support/app";

const makeJob = () => {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(18, 0, 0, 0);

  return {
    id: "mobile-smoke-job",
    title: "Trabajo móvil de prueba",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: "Confirmado",
    job_type: "single",
    color: "#2563eb",
    location: {
      id: "mobile-smoke-location",
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
  };
};

const bootstrapManagement = async (page: Page) => {
  await bootstrapApp(page, {
    auth: {
      userId: "user-1",
      role: "management",
      department: "sound",
    },
    tables: {
      profiles: [
        {
          id: "user-1",
          first_name: "María",
          last_name: "Pruebas",
          role: "management",
          department: "sound",
          selected_job_statuses: ["Confirmado", "Tentativa"],
          selected_job_types: [],
        },
      ],
      jobs: [makeJob()],
      tours: [],
      technician_fridge: [],
      availability_schedules: [],
      technician_availability: [],
      vacation_requests: [],
      timesheets: [],
      job_assignments: [],
      skills: [],
      job_required_roles_summary: [],
    },
    rpc: {
      get_profiles_with_skills: [],
      get_job_staffing_summary: [],
      get_active_timesheet_counts_by_technician: [],
      get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [],
      get_staffing_requests_matrix_filtered: [],
    },
  });
};

const expectMobileShell = async (page: Page) => {
  await expect(page.locator("[data-mobile-navbar]")).toBeVisible();
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
};

test.describe("mobile navigation smoke", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "This suite targets the explicit mobile viewport project.",
    );
  });

  test("keeps the dashboard inside the viewport", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await expectMobileShell(page);
  });

  test("keeps project management inside the viewport", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/project-management");

    await expect(page.getByText("Trabajo móvil de prueba")).toBeVisible();
    await expectMobileShell(page);
  });

  test("keeps the department hub inside the viewport", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/sound");

    await expect(page.getByRole("heading", { name: "Sonido" })).toBeVisible();
    await expectMobileShell(page);
  });

  test("gives every matrix corner control a usable, non-overlapping tap area", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/job-assignment-matrix");

    await expect(page.locator(".matrix-corner")).toBeVisible();

    // The corner is a fixed 110x64 box holding four controls, so a 44px tap
    // target would be wider than the pitch between them and a near-miss would
    // fire the neighbouring action. Each control instead fills its own layout
    // cell. Measured by real hit-testing, not by reading the CSS back: the
    // targets are pseudo-elements, so the element boxes do not describe them.
    const targets = await page.evaluate(() => {
      const corner = document.querySelector(".matrix-corner") as HTMLElement;
      const rect = corner.getBoundingClientRect();
      const controls: Record<string, HTMLElement | null> = {
        "ordenar técnicos": corner.querySelector('button[title*="orden"]'),
        "añadir usuario": corner.querySelector('button[aria-label="Añadir usuario"]'),
        "fechas anteriores": corner.querySelector('button[aria-label="Fechas anteriores"]'),
        "fechas siguientes": corner.querySelector('button[aria-label="Fechas siguientes"]'),
      };

      const boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
      for (let y = rect.y + 0.5; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x + 0.5; x < rect.x + rect.width; x += 1) {
          const hit = document.elementFromPoint(x, y);
          for (const [name, el] of Object.entries(controls)) {
            if (!el || !(el === hit || el.contains(hit as Node))) continue;
            const box = (boxes[name] ??= { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
            box.x0 = Math.min(box.x0, x);
            box.y0 = Math.min(box.y0, y);
            box.x1 = Math.max(box.x1, x);
            box.y1 = Math.max(box.y1, y);
            break;
          }
        }
      }

      const sizes = Object.fromEntries(
        Object.entries(boxes).map(([name, b]) => [
          name,
          { width: Math.round(b.x1 - b.x0 + 1), height: Math.round(b.y1 - b.y0 + 1) },
        ]),
      );

      const overlaps: string[] = [];
      const names = Object.keys(boxes);
      for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
          const a = boxes[names[i]];
          const b = boxes[names[j]];
          if (Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0)) {
            overlaps.push(`${names[i]} / ${names[j]}`);
          }
        }
      }

      return { sizes, overlaps };
    });

    // All four controls are reachable.
    expect(Object.keys(targets.sizes).sort()).toEqual([
      "añadir usuario",
      "fechas anteriores",
      "fechas siguientes",
      "ordenar técnicos",
    ]);

    // WCAG 2.5.8 (AA) minimum. The sort control used to be 16px tall.
    for (const [name, size] of Object.entries(targets.sizes)) {
      expect(size.width, `${name} tap width`).toBeGreaterThanOrEqual(24);
      expect(size.height, `${name} tap height`).toBeGreaterThanOrEqual(24);
    }

    // A tap can never be ambiguous between two corner controls.
    expect(targets.overlaps).toEqual([]);
  });
});
