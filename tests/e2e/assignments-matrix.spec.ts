import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

/** One staffing cycle already answered on a job that was later extended by two days. */
async function openExtendedJobMatrix(page: Page, query: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const day = (offset: number) => {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const job = { id: "extended-job", title: "Festival ampliado", start_time: `${day(0)}T08:00:00Z`, end_time: `${day(3)}T18:00:00Z`, color: "#f97316", status: "Confirmado", job_type: "single", job_departments: [{ department: "sound" }], job_assignments: [] };
  const membership = { job_id: job.id, technician_id: "tech-1", status: "confirmed", sound_role: "SND-MON-E", single_day: true, assignment_date: day(1) };
  const requests = ["availability", "offer"].map(phase => ({ id: `original-${phase}`, job_id: job.id, profile_id: "tech-1", phase, status: "confirmed", single_day: false, target_date: null, updated_at: `${day(-1)}T10:00:00Z`, created_at: `${day(-2)}T10:00:00Z`, requested_by: null }));
  await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: [job], job_date_types: [], job_assignments: [membership],
      timesheets: [1, 2].map(offset => ({ id: `ts-${offset}`, job_id: job.id, technician_id: "tech-1", date: day(offset), is_active: true, source: "staffing" })),
      staffing_requests: requests, staffing_events: [], technician_fridge: [], availability_schedules: [], technician_availability: [], vacation_requests: [], profiles: [], skills: [], job_required_roles_summary: [],
    },
    rpc: {
      get_profiles_with_skills: [{ id: "tech-1", first_name: "Ana", last_name: "Prueba", email: "ana@example.test", department: "sound", role: "technician", skills: [] }],
      get_job_staffing_summary: [], get_active_timesheet_counts_by_technician: [],
      get_assignment_matrix_staffing_filtered: [{ job_id: job.id, profile_id: "tech-1", availability_status: "confirmed", offer_status: "confirmed" }],
      get_staffing_requests_matrix_filtered: requests,
    },
  });
  await page.goto(`/job-assignment-matrix${query}`);
  return {
    day,
    original: page.locator(`[data-technician-id="tech-1"][data-date-key="${day(1)}"]`),
    added: page.locator(`[data-technician-id="tech-1"][data-date-key="${day(0)}"]`),
  };
}

test("extended job dates stay open for a new staffing cycle without repeating single-day badges", async ({ page }) => {
  const { original, added } = await openExtendedJobMatrix(page, "");
  await expect(original).toContainText("Festival ampliado");
  await expect(original).not.toContainText("Día único");
  await expect(added).toHaveAttribute("data-matrix-cell-state", "today");
  await expect(added).not.toContainText(/Disponibilidad|Confirmada|Oferta/i);
  // The added day carries no answered request of the first cycle, and a new one can be composed right there.
  await added.click();
  const inspector = page.getByRole("dialog");
  await expect(inspector).toBeVisible();
  await expect(inspector).not.toContainText(/Disponibilidad:|Oferta:/);
  await inspector.getByRole("button", { name: /Pedir disponibilidad u oferta/ }).click();
  await expect(inspector.getByRole("radiogroup", { name: "Qué enviar" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: /Pedir disponibilidad/ })).toBeVisible();
});
