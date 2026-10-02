import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp } from "./support/app";

/**
 * Coming back to the app must not rebuild the page.
 *
 * A token refresh — which supabase-js runs when a tab returns after its token
 * aged, and the app's own TokenManager runs on a timer and on return — used to
 * put the auth provider back into "profile loading", and ProtectedRoute swapped
 * the whole page for a spinner and back: scroll position, open dialogs and
 * half-typed input gone, exactly like a reload. These specs mark the live DOM,
 * cause the refresh the real way, and require the same DOM afterwards.
 */

const today = () => {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

async function openMatrix(page: Page) {
  const tokenRequests: string[] = [];
  const ownProfileReads: number[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/auth/v1/token")) tokenRequests.push(url);
    // The signed-in user's own profile read (role, department, access flags).
    if (url.includes("/rest/v1/profiles") && url.includes("id=eq.e2e-user")) ownProfileReads.push(Date.now());
  });

  await page.clock.install();
  await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: [
        {
          id: "job-1",
          title: "Bolo",
          start_time: `${today()}T08:00:00.000Z`,
          end_time: `${today()}T20:00:00.000Z`,
          color: "#1d4ed8",
          status: "Confirmado",
          job_type: "single",
          job_departments: [{ department: "sound" }],
          job_assignments: [],
        },
      ],
      technician_fridge: [],
      availability_schedules: [],
      technician_availability: [],
      vacation_requests: [],
      timesheets: [],
      job_assignments: [],
      // The signed-in manager's own profile row, as the real table has it.
      profiles: [
        { id: "e2e-user", role: "management", department: "sound", soundvision_access: false, assignable_as_tech: false },
      ],
      skills: [],
      job_required_roles_summary: [],
      staffing_requests: [],
      staffing_events: [],
    },
    rpc: {
      get_profiles_with_skills: Array.from({ length: 40 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        first_name: `Técnico${index}`,
        last_name: "Prueba",
        email: `t${index}@example.com`,
        department: "sound",
        role: "technician",
        skills: [],
      })),
      get_job_staffing_summary: [],
      get_active_timesheet_counts_by_technician: [],
      get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [],
      get_staffing_requests_matrix_filtered: [],
    },
  });

  await page.goto("/job-assignment-matrix");
  await expect(page.locator('[data-matrix-cell="true"]').first()).toBeVisible();

  // Mark the live page and move away from the initial scroll position: a
  // remount loses both.
  await page.locator(".matrix-main-scroll").evaluate((el) => {
    (el as HTMLElement & { __e2eMarker?: boolean }).__e2eMarker = true;
    el.scrollTop = 400;
  });
  return { tokenRequests, ownProfileReads };
}

async function expectSamePage(page: Page) {
  // Long enough for a profile refetch and a spinner swap to have happened.
  await page.clock.runFor(3000);
  await page.waitForTimeout(500);
  const state = await page.locator(".matrix-main-scroll").evaluate((el) => ({
    marker: Boolean((el as HTMLElement & { __e2eMarker?: boolean }).__e2eMarker),
    scrollTop: el.scrollTop,
  }));
  expect(state).toEqual({ marker: true, scrollTop: 400 });
}

const setVisibility = (page: Page, state: "hidden" | "visible") =>
  page.evaluate((next) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => next });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => next === "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

test("switching to another tab and back keeps the page as it was", async ({ page }) => {
  const { tokenRequests, ownProfileReads } = await openMatrix(page);
  const profileReadsBefore = ownProfileReads.length;

  await setVisibility(page, "hidden");
  await page.clock.fastForward("06:00");
  await setVisibility(page, "visible");

  // The return refreshes the token, the trigger this guards against.
  await expect.poll(() => tokenRequests.length).toBeGreaterThan(0);
  await expectSamePage(page);
  // The profile is still re-read after the refresh (an admin's role change has
  // to reach a signed-in user), just without taking the page down.
  expect(ownProfileReads.length).toBeGreaterThan(profileReadsBefore);
});

test("sitting idle through a token refresh keeps the page as it was", async ({ page }) => {
  const { tokenRequests } = await openMatrix(page);

  // Past the point where the session is refreshed in the background.
  await page.clock.fastForward("58:00");

  await expect.poll(() => tokenRequests.length).toBeGreaterThan(0);
  await expectSamePage(page);
});
