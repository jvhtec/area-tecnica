import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

/**
 * Scroll/interaction benchmark for the assignment matrix on a realistically
 * dense dataset. Opt-in (MATRIX_PERF=1): it measures, it does not gate CI,
 * because frame times depend on the machine. Run against a production build
 * for meaningful numbers:
 *
 *   MATRIX_PERF=1 PLAYWRIGHT_PRODUCTION=1 npx playwright test matrix-performance --project=chromium
 */

const TECHNICIANS = 150;
const DAYS_BEFORE = 30;
const DAYS_AFTER = 60;
const JOBS = 45;
const CPU_THROTTLE = Number(process.env.MATRIX_PERF_CPU_THROTTLE ?? 4);

const dayKey = (offset: number) => {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

function buildDataset() {
  const technicians = Array.from({ length: TECHNICIANS }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    first_name: `Técnico${index}`,
    last_name: `Apellido${index}`,
    nickname: null,
    email: `tech${index}@example.com`,
    department: "sound",
    role: index % 4 === 0 ? "house_tech" : "technician",
    skills: [],
  }));

  const colors = ["#1d4ed8", "#b91c1c", "#047857", "#7c3aed", "#c2410c", "#0e7490"];
  const jobs = Array.from({ length: JOBS }, (_, index) => {
    const start = -DAYS_BEFORE + Math.floor((index * (DAYS_BEFORE + DAYS_AFTER)) / JOBS);
    const length = 1 + (index % 4);
    return {
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      title: `Bolo ${index}`,
      start_time: `${dayKey(start)}T08:00:00.000Z`,
      end_time: `${dayKey(start + length - 1)}T20:00:00.000Z`,
      color: colors[index % colors.length],
      status: "Confirmado",
      job_type: "single",
      job_departments: [{ department: "sound" }],
      job_assignments: [],
      job_date_types: [],
    };
  });

  const timesheets: Array<Record<string, unknown>> = [];
  const assignments: Array<Record<string, unknown>> = [];
  const staffingRequests: Array<Record<string, unknown>> = [];
  technicians.forEach((tech, techIndex) => {
    jobs.forEach((job, jobIndex) => {
      const roll = (techIndex * 7 + jobIndex * 13) % 10;
      if (roll < 2) {
        assignments.push({
          job_id: job.id,
          technician_id: tech.id,
          sound_role: "SND-FOH-R",
          lights_role: null,
          video_role: null,
          single_day: false,
          assignment_date: null,
          status: roll === 0 ? "invited" : "confirmed",
          assigned_at: new Date().toISOString(),
          assigned_by: null,
        });
        const start = new Date(job.start_time);
        const end = new Date(job.end_time);
        for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
          timesheets.push({
            job_id: job.id,
            technician_id: tech.id,
            date: day.toISOString().slice(0, 10),
            is_schedule_only: false,
            source: "assignment",
          });
        }
      } else if (roll === 3) {
        staffingRequests.push({
          id: `20000000-${String(techIndex).padStart(4, "0")}-4000-8000-${String(jobIndex).padStart(12, "0")}`,
          job_id: job.id,
          profile_id: tech.id,
          phase: jobIndex % 2 ? "availability" : "offer",
          status: "pending",
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          single_day: false,
          target_date: null,
          requested_by: null,
        });
      }
    });
  });

  return { technicians, jobs, timesheets, assignments, staffingRequests };
}

interface FrameStats {
  frames: number;
  p50: number;
  p95: number;
  max: number;
  over33: number;
  longTaskMs: number;
}

/** Scrolls the grid a fixed distance per frame and reports frame durations. */
async function measureScroll(page: Page, axis: "x" | "y", step: number, frames: number): Promise<FrameStats> {
  return page.evaluate(
    async ({ axis, step, frames }) => {
      const el = document.querySelector<HTMLElement>(".matrix-main-scroll");
      if (!el) throw new Error("matrix scroller not found");
      let longTaskMs = 0;
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          longTaskMs += entry.duration;
        });
      });
      observer.observe({ type: "longtask", buffered: false });

      const durations: number[] = [];
      let last = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      for (let i = 0; i < frames; i += 1) {
        if (axis === "y") el.scrollTop += step;
        else el.scrollLeft += step;
        // Assigning the position fires the browser's own scroll event; no
        // synthetic one, which would double the handler work per frame.
        const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
        durations.push(now - last);
        last = now;
      }
      // Let trailing renders land inside the observation window.
      await new Promise((resolve) => setTimeout(resolve, 300));
      observer.disconnect();

      const sorted = [...durations].sort((a, b) => a - b);
      const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
      return {
        frames: durations.length,
        p50: Math.round(pick(0.5) * 10) / 10,
        p95: Math.round(pick(0.95) * 10) / 10,
        max: Math.round(sorted[sorted.length - 1] * 10) / 10,
        over33: durations.filter((d) => d > 33.4).length,
        longTaskMs: Math.round(longTaskMs),
      };
    },
    { axis, step, frames },
  );
}

test("assignment matrix stays smooth on a dense dataset", async ({ page }) => {
  test.skip(!process.env.MATRIX_PERF, "Benchmark; run with MATRIX_PERF=1.");
  test.skip(isMobileViewport(page), "Desktop benchmark.");
  test.setTimeout(180_000);

  const data = buildDataset();
  await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: data.jobs,
      technician_fridge: [],
      availability_schedules: [],
      technician_availability: [],
      vacation_requests: [],
      timesheets: data.timesheets,
      job_assignments: data.assignments,
      staffing_requests: data.staffingRequests,
      staffing_events: [],
      profiles: [],
      skills: [],
      job_required_roles_summary: [],
    },
    rpc: {
      get_profiles_with_skills: data.technicians,
      get_job_staffing_summary: [],
      get_active_timesheet_counts_by_technician: [],
      get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [],
      get_staffing_requests_matrix_filtered: [],
    },
  });

  await page.goto("/job-assignment-matrix");
  await expect(page.locator('[data-matrix-cell="true"]').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);

  if (process.env.MATRIX_PERF_DOM) {
    const dom = await page.evaluate(() => {
      const count = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).reduce((n, el) => n + el.querySelectorAll("*").length + 1, 0);
      return {
        total: document.querySelectorAll("*").length,
        grid: count(".matrix-grid"),
        cells: document.querySelectorAll("[data-matrix-cell]").length,
        headers: count(".matrix-date-headers"),
        technicianColumn: count(".matrix-technician-column"),
        outsideMatrix: document.querySelectorAll("*").length - count(".matrix-layout"),
      };
    });
    console.log(`MATRIX_DOM ${JSON.stringify(dom)}`);
  }

  const screenshotDir = process.env.MATRIX_PERF_SCREENSHOTS;
  if (screenshotDir) {
    await page.screenshot({ path: `${screenshotDir}/matrix-initial.png` });
    await page.locator(".matrix-main-scroll").evaluate((el) => el.scrollBy({ left: 900, top: 700 }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${screenshotDir}/matrix-scrolled.png` });
    await page.locator(".matrix-main-scroll").evaluate((el) => el.scrollBy({ left: -900, top: -700 }));
    await page.waitForTimeout(300);
  }

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });

  const profilePath = process.env.MATRIX_PERF_PROFILE;
  if (profilePath) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  }

  await cdp.send("Performance.enable");
  const metricsNow = async () => {
    const { metrics } = await cdp.send("Performance.getMetrics");
    return Object.fromEntries(metrics.map((m: { name: string; value: number }) => [m.name, m.value]));
  };
  // Main-thread time by kind (ms) across one scroll run.
  const breakdown = async <T,>(run: () => Promise<T>) => {
    const before = await metricsNow();
    const result = await run();
    const after = await metricsNow();
    const ms = (key: string) => Math.round((after[key] - before[key]) * 1000);
    return {
      ...result,
      scriptMs: ms("ScriptDuration"),
      styleMs: ms("RecalcStyleDuration"),
      layoutMs: ms("LayoutDuration"),
      taskMs: ms("TaskDuration"),
      nodes: after.Nodes,
    };
  };

  const vertical = await breakdown(() => measureScroll(page, "y", 36, 120));
  const horizontal = await breakdown(() => measureScroll(page, "x", 60, 120));

  if (profilePath) {
    const { profile } = await cdp.send("Profiler.stop");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(profilePath, JSON.stringify(profile));
  }

  // Selecting a cell (ctrl-click) used to re-render the whole visible grid.
  const clickMs = await page.evaluate(async () => {
    const cell = document.querySelectorAll<HTMLElement>('[data-matrix-cell="true"]')[40];
    const started = performance.now();
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round(performance.now() - started);
  });

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const result = { cpuThrottle: CPU_THROTTLE, vertical, horizontal, clickMs };
  console.log(`MATRIX_PERF ${JSON.stringify(result)}`);
  test.info().annotations.push({ type: "matrix-perf", description: JSON.stringify(result) });
});
